const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Settings = require('../models/Settings');
const closeExpiredSessions = require('../utils/autoSignOut');
const audit = require('../utils/audit');
const { fail } = require('../utils/httpError');
const { loadRange } = require('../utils/context');
const { computeDay, summarize } = require('../utils/dayStatus');
const {
  dateStrIn, minutesOfDayIn, hhmmToMinutes, isValidDateStr, isValidHHMM,
  dateRange, monthBounds, addDays, zonedToDate, formatMinutes,
} = require('../utils/time');

const lateMinutesFor = (signIn, settings) => {
  const mins = minutesOfDayIn(signIn, settings.timezone);
  const start = hhmmToMinutes(settings.workStart);
  return mins > start + settings.graceMinutes ? mins - start : 0;
};

const publicSettings = (s) => ({
  companyName: s.companyName, timezone: s.timezone, workStart: s.workStart, workEnd: s.workEnd,
  graceMinutes: s.graceMinutes, fullDayHours: s.fullDayHours, halfDayHours: s.halfDayHours,
  autoSignOutHours: s.autoSignOutHours, weekendDays: s.weekendDays,
});

const clip = (v, n) => String(v || '').trim().slice(0, n);

// ---------- self service ----------

const signIn = async (req, res) => {
  const settings = await Settings.get();
  await closeExpiredSessions(settings);
  const today = dateStrIn(settings.timezone);

  const open = await Attendance.findOne({ user: req.user._id, signOutTime: null, signInTime: { $ne: null } });
  if (open) fail(400, 'You are already signed in. Sign out first.');
  const existing = await Attendance.findOne({ user: req.user._id, date: today });
  if (existing) fail(400, 'You have already completed today\'s shift');

  const now = new Date();
  const record = await Attendance.create({
    user: req.user._id,
    date: today,
    signInTime: now,
    lateMinutes: lateMinutesFor(now, settings),
    signInNote: clip(req.body.note, 300),
  });
  res.status(201).json({
    message: record.lateMinutes ? `Signed in, ${formatMinutes(record.lateMinutes)} after start time` : 'Signed in on time',
    record,
  });
};

const signOut = async (req, res) => {
  const settings = await Settings.get();
  await closeExpiredSessions(settings);
  const open = await Attendance.findOne({ user: req.user._id, signOutTime: null, signInTime: { $ne: null } }).sort({ signInTime: -1 });
  if (!open) fail(400, 'You are not signed in');
  open.signOutTime = new Date();
  open.signOutNote = clip(req.body.note, 500);
  await open.save();
  const worked = Math.floor((open.signOutTime - open.signInTime) / 60000);
  res.json({ message: `Signed out. You worked ${formatMinutes(worked)}.`, record: open });
};

const status = async (req, res) => {
  const settings = await Settings.get();
  await closeExpiredSessions(settings);
  const today = dateStrIn(settings.timezone);
  const weekStart = addDays(today, -6);
  const ctx = await loadRange({ start: weekStart, end: today, userIds: [req.user._id] });

  // An open session from yesterday (night shift) still counts as "current".
  const open = await Attendance.findOne({ user: req.user._id, signOutTime: null, signInTime: { $ne: null } });
  const todayRecord = ctx.recordFor(req.user._id, today) || null;
  const current = open || todayRecord;

  const week = dateRange(weekStart, today).map((date) => computeDay({
    date, record: ctx.recordFor(req.user._id, date), leave: ctx.leaveFor(req.user._id, date),
    holiday: ctx.holidayMap.get(date), settings, today, joinDate: req.user.joinDate,
  }));

  res.json({
    serverTime: new Date(),
    today,
    settings: publicSettings(settings),
    record: current,
    day: week[week.length - 1],
    week,
    weekSummary: summarize(week),
    holidayToday: ctx.holidayMap.get(today)?.name || '',
    canSignIn: !open && !todayRecord,
    canSignOut: !!open,
  });
};

const resolveRange = (query, settings) => {
  const today = dateStrIn(settings.timezone);
  let { start, end, month } = query;
  if (month && /^\d{4}-\d{2}$/.test(month)) ({ start, end } = monthBounds(month));
  if (!isValidDateStr(start) || !isValidDateStr(end)) ({ start, end } = monthBounds(today.slice(0, 7)));
  if (start > end) [start, end] = [end, start];
  const days = dateRange(start, end, 370);
  return { start, end: days[days.length - 1], today };
};

const userDays = (user, start, end, ctx) => dateRange(start, end).map((date) => computeDay({
  date, record: ctx.recordFor(user._id, date), leave: ctx.leaveFor(user._id, date),
  holiday: ctx.holidayMap.get(date), settings: ctx.settings, today: ctx.today, joinDate: user.joinDate,
}));

const myHistory = async (req, res) => {
  const settings = await Settings.get();
  await closeExpiredSessions(settings);
  const { start, end } = resolveRange(req.query, settings);
  const ctx = await loadRange({ start, end, userIds: [req.user._id] });
  const days = userDays(req.user, start, end, ctx);
  res.json({ start, end, days, summary: summarize(days), settings: publicSettings(settings) });
};

// ---------- manager ----------

const scopedUsers = async ({ role, department, employeeId }) => {
  if (employeeId) {
    if (!mongoose.isValidObjectId(employeeId)) fail(400, 'Invalid employee');
    const u = await User.findById(employeeId);
    if (!u) fail(404, 'Employee not found');
    return [u];
  }
  const filter = { isActive: true };
  if (role) filter.role = role;
  if (department) filter.department = department;
  return User.find(filter).sort({ name: 1 });
};

const records = async (req, res) => {
  const settings = await Settings.get();
  await closeExpiredSessions(settings);
  const { employeeId, role, department } = req.query;
  const hasRange = req.query.start || req.query.end || req.query.month;
  const today = dateStrIn(settings.timezone);
  const { start, end } = hasRange ? resolveRange(req.query, settings) : { start: today, end: today };
  const users = await scopedUsers({ employeeId, role, department });
  const ctx = await loadRange({ start, end, userIds: users.map((u) => u._id) });

  if (employeeId) {
    const u = users[0];
    const days = userDays(u, start, end, ctx);
    return res.json({
      mode: 'single', start, end,
      employee: { id: u._id, name: u.name, role: u.role, department: u.department, designation: u.designation },
      records: days, summary: summarize(days),
    });
  }

  if (start === end) {
    const rows = users.map((u) => {
      const d = userDays(u, start, end, ctx)[0];
      return { ...d, _id: u._id, name: u.name, role: u.role, department: u.department };
    });
    return res.json({ mode: 'day', date: start, records: rows, summary: summarize(rows) });
  }

  const perUser = users.map((u) => ({ u, days: userDays(u, start, end, ctx) }));
  const dates = dateRange(start, end);
  res.json({
    mode: 'matrix', start, end,
    employees: perUser.map(({ u, days }) => ({
      id: u._id, name: u.name, role: u.role, department: u.department, summary: summarize(days),
    })),
    rows: dates.map((date, i) => ({
      date,
      holiday: ctx.holidayMap.get(date)?.name || '',
      cells: Object.fromEntries(perUser.map(({ u, days }) => [u._id, { s: days[i].status, h: days[i].workedMinutes, id: days[i].recordId, in: days[i].signInTime, out: days[i].signOutTime, n: days[i].managerNote }])),
    })),
  });
};

const toDate = (dateStr, hhmm, tz) => (hhmm ? zonedToDate(dateStr, hhmm, tz) : null);

const upsertManual = async (req, res) => {
  const { userId, date, signIn: inTime, signOut: outTime, managerNote } = req.body;
  if (!mongoose.isValidObjectId(userId)) fail(400, 'Choose a person');
  if (!isValidDateStr(date)) fail(400, 'Date must be YYYY-MM-DD');
  if (!isValidHHMM(inTime)) fail(400, 'Sign-in time must be HH:MM');
  if (outTime && !isValidHHMM(outTime)) fail(400, 'Sign-out time must be HH:MM');

  const settings = await Settings.get();
  const user = await User.findById(userId);
  if (!user) fail(404, 'Person not found');

  const signInTime = toDate(date, inTime, settings.timezone);
  let signOutTime = toDate(date, outTime, settings.timezone);
  if (signOutTime && signOutTime <= signInTime) signOutTime = new Date(signOutTime.getTime() + 86400000); // overnight
  if (signInTime > new Date()) fail(400, 'Sign-in time cannot be in the future');

  let record = await Attendance.findOne({ user: userId, date });
  const isNew = !record;
  if (!record) record = new Attendance({ user: userId, date });
  Object.assign(record, {
    signInTime, signOutTime, lateMinutes: lateMinutesFor(signInTime, settings),
    managerNote: clip(managerNote, 300), source: isNew ? 'manual' : record.source,
    autoSignedOut: false, editedBy: req.user._id, editedAt: new Date(),
  });
  await record.save();
  await audit(req.user, isNew ? 'attendance.add' : 'attendance.edit', user.name,
    `${date}: ${inTime}–${outTime || 'open'}${managerNote ? ` (${clip(managerNote, 80)})` : ''}`);
  res.status(isNew ? 201 : 200).json(record);
};

const removeRecord = async (req, res) => {
  const record = await Attendance.findById(req.params.id).populate('user', 'name');
  if (!record) fail(404, 'Record not found');
  await record.deleteOne();
  await audit(req.user, 'attendance.delete', record.user?.name || '', record.date);
  res.json({ message: 'Record deleted' });
};

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const exportCsv = async (req, res) => {
  const settings = await Settings.get();
  const { start, end } = resolveRange(req.query, settings);
  const users = await scopedUsers(req.query);
  const ctx = await loadRange({ start, end, userIds: users.map((u) => u._id) });
  const tf = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fmt = (d) => (d ? tf.format(new Date(d)) : '');

  const lines = [['Employee', 'Code', 'Role', 'Department', 'Date', 'Status', 'Sign in', 'Sign out', 'Worked (h)', 'Late (min)', 'Notes'].join(',')];
  for (const u of users) {
    for (const d of userDays(u, start, end, ctx)) {
      if (d.status === 'none') continue;
      const notes = [d.signInNote, d.signOutNote, d.managerNote, d.holidayName, d.leaveType && `${d.leaveType} leave`, d.autoSignedOut && 'auto signed out']
        .filter(Boolean).join(' | ');
      lines.push([u.name, u.employeeCode, u.role, u.department, d.date, d.status, fmt(d.signInTime), fmt(d.signOutTime),
        (d.workedMinutes / 60).toFixed(2), d.lateMinutes || 0, notes].map(csvCell).join(','));
    }
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="attendance_${start}_to_${end}.csv"`);
  res.send(`﻿${lines.join('\n')}`);
};

module.exports = { signIn, signOut, status, myHistory, records, upsertManual, removeRecord, exportCsv, lateMinutesFor };

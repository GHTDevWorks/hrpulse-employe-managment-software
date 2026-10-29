/*
 * In-browser demo API.
 *
 * When demo mode is on, every request the app makes to /api is answered here instead of
 * by the Express server. Data lives in this browser's localStorage, pre-filled with a
 * sample team, so the app works on any static host (e.g. Vercel) with no database.
 * The endpoints and rules mirror backend/controllers/*.
 */
import {
  dateStrIn, minutesOfDayIn, hhmmToMinutes, isValidDateStr, isValidHHMM,
  weekdayOf, addDays, dateRange, monthBounds, zonedToDate, formatMinutes,
  computeDay, summarize, buildLeaveIndex,
} from './logic';

const KEY = 'hrp-demo-db';
const ROLES = ['employee', 'developer', 'manager'];
const LEAVE_TYPES = ['annual', 'sick', 'casual', 'unpaid'];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

const oid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
const nowIso = () => new Date().toISOString();
const stamp = (doc) => ({ _id: oid(), createdAt: nowIso(), updatedAt: nowIso(), ...doc });
const clone = (v) => JSON.parse(JSON.stringify(v));
const clip = (v, n) => String(v || '').trim().slice(0, n);

const DEFAULT_SETTINGS = {
  key: 'global', companyName: 'HRPulse', timezone: 'Asia/Karachi', workStart: '09:00', workEnd: '18:00',
  graceMinutes: 15, fullDayHours: 8, halfDayHours: 4, autoSignOutHours: 15, weekendDays: [0, 6],
  leaveAllowance: { annual: 14, sick: 8, casual: 10 },
};

// ---------------------------------------------------------------- storage

let db = null;

const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or blocked: keep in memory */ }
};
const touch = () => { db.dirty = true; persist(); };

const load = () => {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  const today = dateStrIn((db?.settings || DEFAULT_SETTINGS).timezone);
  // Fresh sample data each day unless the visitor has changed something.
  if (!db || db.v !== 1 || (!db.dirty && db.seededOn !== today)) {
    db = seed();
    persist();
  }
  return db;
};

export const resetDemoData = () => {
  db = seed();
  persist();
};

// ---------------------------------------------------------------- helpers

const S = () => db.settings;
const userById = (id) => db.users.find((u) => u._id === id);
const safeUser = (u) => { if (!u) return null; const { password, ...rest } = u; return clone(rest); };
const withOrg = (u) => ({ ...safeUser(u), timezone: S().timezone, companyName: S().companyName });
const ref = (id, fields) => {
  const u = userById(id);
  if (!u) return null;
  return Object.fromEntries([['_id', u._id], ...fields.map((f) => [f, u[f]])]);
};

const audit = (actor, action, targetName = '', details = '') => {
  db.audit.unshift(stamp({ actor: actor?._id, actorName: actor?.name || 'System', action, targetName, details }));
  db.audit = db.audit.slice(0, 500);
};

const lateMinutesFor = (signIn, s) => {
  const mins = minutesOfDayIn(new Date(signIn), s.timezone);
  const start = hhmmToMinutes(s.workStart);
  return mins > start + s.graceMinutes ? mins - start : 0;
};

const publicSettings = (s) => ({
  companyName: s.companyName, timezone: s.timezone, workStart: s.workStart, workEnd: s.workEnd,
  graceMinutes: s.graceMinutes, fullDayHours: s.fullDayHours, halfDayHours: s.halfDayHours,
  autoSignOutHours: s.autoSignOutHours, weekendDays: s.weekendDays,
});

const closeExpired = () => {
  const limit = S().autoSignOutHours * 3600 * 1000;
  let changed = false;
  for (const r of db.attendances) {
    if (r.signInTime && !r.signOutTime && Date.now() - new Date(r.signInTime).getTime() >= limit) {
      r.signOutTime = new Date(new Date(r.signInTime).getTime() + limit).toISOString();
      r.autoSignedOut = true;
      changed = true;
    }
  }
  if (changed) persist();
};

const loadRange = ({ start, end, userIds }) => {
  const settings = S();
  const today = dateStrIn(settings.timezone);
  const ids = userIds ? new Set(userIds) : null;
  const holidayMap = new Map(db.holidays.filter((h) => h.date >= start && h.date <= end).map((h) => [h.date, h]));
  const leavesByUser = new Map();
  for (const l of db.leaves) {
    if (l.status !== 'approved' || l.startDate > end || l.endDate < start || (ids && !ids.has(l.user))) continue;
    if (!leavesByUser.has(l.user)) leavesByUser.set(l.user, []);
    leavesByUser.get(l.user).push(l);
  }
  const leaveIdx = new Map([...leavesByUser].map(([k, v]) => [k, buildLeaveIndex(v)]));
  const recordMap = new Map(db.attendances.filter((r) => r.date >= start && r.date <= end && (!ids || ids.has(r.user))).map((r) => [`${r.user}|${r.date}`, r]));
  return {
    settings, today, holidayMap,
    recordFor: (u, d) => recordMap.get(`${u}|${d}`),
    leaveFor: (u, d) => leaveIdx.get(u)?.get(d),
  };
};

const dayFor = (ctx, user, date) => computeDay({
  date, record: ctx.recordFor(user._id, date), leave: ctx.leaveFor(user._id, date),
  holiday: ctx.holidayMap.get(date), settings: ctx.settings, today: ctx.today, joinDate: user.joinDate,
});
const userDays = (user, start, end, ctx) => dateRange(start, end).map((d) => dayFor(ctx, user, d));

const resolveRange = (q) => {
  const today = dateStrIn(S().timezone);
  let { start, end } = q;
  if (q.month && /^\d{4}-\d{2}$/.test(q.month)) ({ start, end } = monthBounds(q.month));
  if (!isValidDateStr(start) || !isValidDateStr(end)) ({ start, end } = monthBounds(today.slice(0, 7)));
  if (start > end) [start, end] = [end, start];
  const days = dateRange(start, end, 370);
  return { start, end: days[days.length - 1], today };
};

const countWorkingDays = (start, end) => {
  const hol = new Set(db.holidays.map((h) => h.date));
  return dateRange(start, end).filter((d) => !S().weekendDays.includes(weekdayOf(d)) && !hol.has(d)).length;
};

const balanceFor = (userId, year) => {
  const leaves = db.leaves.filter((l) => l.user === userId && ['approved', 'pending'].includes(l.status) && l.startDate.startsWith(String(year)));
  const out = {};
  for (const t of LEAVE_TYPES) {
    const allowance = t === 'unpaid' ? null : S().leaveAllowance?.[t] ?? 0;
    const used = leaves.filter((l) => l.type === t && l.status === 'approved').reduce((a, l) => a + l.days, 0);
    const pending = leaves.filter((l) => l.type === t && l.status === 'pending').reduce((a, l) => a + l.days, 0);
    out[t] = { allowance, used, pending, remaining: allowance === null ? null : allowance - used - pending };
  }
  return out;
};

const leaveOut = (l) => ({ ...clone(l), user: ref(l.user, ['name', 'role', 'department']), reviewedBy: l.reviewedBy ? ref(l.reviewedBy, ['name']) : null });

// ---------------------------------------------------------------- handlers

const H = {};

// auth
H.login = ({ body }) => {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) fail(400, 'Enter your email and password');
  const u = db.users.find((x) => x.email === email);
  if (!u || u.password !== password) fail(401, 'Email or password is incorrect');
  if (!u.isActive) fail(403, 'Your account has been deactivated. Contact your manager.');
  u.lastLoginAt = nowIso();
  persist();
  return { user: withOrg(u), token: `demo.${u._id}` };
};
H.me = ({ user }) => withOrg(user);
H.updateMe = ({ user, body }) => {
  if (body.name !== undefined) { if (!String(body.name).trim()) fail(400, 'Name cannot be empty'); user.name = String(body.name).trim(); }
  if (body.phone !== undefined) user.phone = String(body.phone).trim();
  touch();
  return withOrg(user);
};
H.changePassword = ({ user, body }) => {
  if (!body.newPassword || String(body.newPassword).length < 6) fail(400, 'New password must be at least 6 characters');
  if (String(body.currentPassword || '') !== user.password) fail(400, 'Current password is incorrect');
  user.password = String(body.newPassword);
  audit(user, 'password.change', user.name);
  touch();
  return { message: 'Password updated' };
};

// attendance (self)
H.signIn = ({ user, body }) => {
  closeExpired();
  const today = dateStrIn(S().timezone);
  if (db.attendances.some((r) => r.user === user._id && r.signInTime && !r.signOutTime)) fail(400, 'You are already signed in. Sign out first.');
  if (db.attendances.some((r) => r.user === user._id && r.date === today)) fail(400, "You have already completed today's shift");
  const now = nowIso();
  const record = stamp({ user: user._id, date: today, signInTime: now, signOutTime: null, lateMinutes: lateMinutesFor(now, S()), signInNote: clip(body.note, 300), signOutNote: '', managerNote: '', source: 'self', autoSignedOut: false });
  db.attendances.push(record);
  touch();
  return { message: record.lateMinutes ? `Signed in, ${formatMinutes(record.lateMinutes)} after start time` : 'Signed in on time', record: clone(record) };
};
H.signOut = ({ user, body }) => {
  closeExpired();
  const open = db.attendances.filter((r) => r.user === user._id && r.signInTime && !r.signOutTime).sort((a, b) => b.signInTime.localeCompare(a.signInTime))[0];
  if (!open) fail(400, 'You are not signed in');
  open.signOutTime = nowIso();
  open.signOutNote = clip(body.note, 500);
  open.updatedAt = nowIso();
  touch();
  const worked = Math.floor((new Date(open.signOutTime) - new Date(open.signInTime)) / 60000);
  return { message: `Signed out. You worked ${formatMinutes(worked)}.`, record: clone(open) };
};
H.status = ({ user }) => {
  closeExpired();
  const today = dateStrIn(S().timezone);
  const weekStart = addDays(today, -6);
  const ctx = loadRange({ start: weekStart, end: today, userIds: [user._id] });
  const open = db.attendances.find((r) => r.user === user._id && r.signInTime && !r.signOutTime);
  const todayRecord = ctx.recordFor(user._id, today) || null;
  const week = dateRange(weekStart, today).map((d) => dayFor(ctx, user, d));
  return {
    serverTime: nowIso(), today, settings: publicSettings(S()), record: clone(open || todayRecord || null),
    day: week[week.length - 1], week, weekSummary: summarize(week),
    holidayToday: ctx.holidayMap.get(today)?.name || '', canSignIn: !open && !todayRecord, canSignOut: !!open,
  };
};
H.myHistory = ({ user, query }) => {
  closeExpired();
  const { start, end } = resolveRange(query);
  const ctx = loadRange({ start, end, userIds: [user._id] });
  const days = userDays(user, start, end, ctx);
  return { start, end, days, summary: summarize(days), settings: publicSettings(S()) };
};

// attendance (manager)
const scopedUsers = ({ role, department, employeeId }) => {
  if (employeeId) { const u = userById(employeeId); if (!u) fail(404, 'Employee not found'); return [u]; }
  return db.users.filter((u) => u.isActive && (!role || u.role === role) && (!department || u.department === department))
    .sort((a, b) => a.name.localeCompare(b.name));
};
H.records = ({ query }) => {
  closeExpired();
  const today = dateStrIn(S().timezone);
  const hasRange = query.start || query.end || query.month;
  const { start, end } = hasRange ? resolveRange(query) : { start: today, end: today };
  const users = scopedUsers(query);
  const ctx = loadRange({ start, end, userIds: users.map((u) => u._id) });
  if (query.employeeId) {
    const u = users[0];
    const days = userDays(u, start, end, ctx);
    return { mode: 'single', start, end, employee: { id: u._id, name: u.name, role: u.role, department: u.department, designation: u.designation }, records: days, summary: summarize(days) };
  }
  if (start === end) {
    const rows = users.map((u) => ({ ...dayFor(ctx, u, start), _id: u._id, name: u.name, role: u.role, department: u.department }));
    return { mode: 'day', date: start, records: rows, summary: summarize(rows) };
  }
  const perUser = users.map((u) => ({ u, days: userDays(u, start, end, ctx) }));
  return {
    mode: 'matrix', start, end,
    employees: perUser.map(({ u, days }) => ({ id: u._id, name: u.name, role: u.role, department: u.department, summary: summarize(days) })),
    rows: dateRange(start, end).map((date, i) => ({
      date, holiday: ctx.holidayMap.get(date)?.name || '',
      cells: Object.fromEntries(perUser.map(({ u, days }) => [u._id, { s: days[i].status, h: days[i].workedMinutes, id: days[i].recordId, in: days[i].signInTime, out: days[i].signOutTime, n: days[i].managerNote }])),
    })),
  };
};
H.manual = ({ user: actor, body }) => {
  const { userId, date, signIn: inT, signOut: outT, managerNote } = body;
  const u = userById(userId);
  if (!u) fail(400, 'Choose a person');
  if (!isValidDateStr(date)) fail(400, 'Date must be YYYY-MM-DD');
  if (!isValidHHMM(inT)) fail(400, 'Sign-in time must be HH:MM');
  if (outT && !isValidHHMM(outT)) fail(400, 'Sign-out time must be HH:MM');
  const tz = S().timezone;
  const signInTime = zonedToDate(date, inT, tz);
  let signOutTime = outT ? zonedToDate(date, outT, tz) : null;
  if (signOutTime && signOutTime <= signInTime) signOutTime = new Date(signOutTime.getTime() + 86400000);
  if (signInTime > new Date()) fail(400, 'Sign-in time cannot be in the future');
  let r = db.attendances.find((x) => x.user === userId && x.date === date);
  const isNew = !r;
  if (!r) { r = stamp({ user: userId, date, signInNote: '', signOutNote: '', source: 'manual' }); db.attendances.push(r); }
  Object.assign(r, {
    signInTime: signInTime.toISOString(), signOutTime: signOutTime ? signOutTime.toISOString() : null,
    lateMinutes: lateMinutesFor(signInTime, S()), managerNote: clip(managerNote, 300), autoSignedOut: false,
    editedBy: actor._id, editedAt: nowIso(), updatedAt: nowIso(),
  });
  audit(actor, isNew ? 'attendance.add' : 'attendance.edit', u.name, `${date}: ${inT}–${outT || 'open'}${managerNote ? ` (${clip(managerNote, 80)})` : ''}`);
  touch();
  return clone(r);
};
H.removeRecord = ({ user, params }) => {
  const r = db.attendances.find((x) => x._id === params.id);
  if (!r) fail(404, 'Record not found');
  db.attendances = db.attendances.filter((x) => x !== r);
  audit(user, 'attendance.delete', userById(r.user)?.name || '', r.date);
  touch();
  return { message: 'Record deleted' };
};
H.exportCsv = ({ query }) => {
  const { start, end } = resolveRange(query);
  const users = scopedUsers(query);
  const ctx = loadRange({ start, end, userIds: users.map((u) => u._id) });
  const tf = new Intl.DateTimeFormat('en-GB', { timeZone: S().timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fmt = (d) => (d ? tf.format(new Date(d)) : '');
  const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [['Employee', 'Code', 'Role', 'Department', 'Date', 'Status', 'Sign in', 'Sign out', 'Worked (h)', 'Late (min)', 'Notes'].join(',')];
  for (const u of users) {
    for (const d of userDays(u, start, end, ctx)) {
      if (d.status === 'none') continue;
      const notes = [d.signInNote, d.signOutNote, d.managerNote, d.holidayName, d.leaveType && `${d.leaveType} leave`, d.autoSignedOut && 'auto signed out'].filter(Boolean).join(' | ');
      lines.push([u.name, u.employeeCode, u.role, u.department, d.date, d.status, fmt(d.signInTime), fmt(d.signOutTime), (d.workedMinutes / 60).toFixed(2), d.lateMinutes || 0, notes].map(cell).join(','));
    }
  }
  return new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
};

H.dashboard = () => {
  closeExpired();
  const settings = S();
  const today = dateStrIn(settings.timezone);
  const start = addDays(today, -13);
  const users = db.users.filter((u) => u.isActive).sort((a, b) => a.name.localeCompare(b.name));
  const ctx = loadRange({ start, end: today, userIds: users.map((u) => u._id) });
  const people = users.map((u) => ({ id: u._id, name: u.name, role: u.role, department: u.department, designation: u.designation, ...dayFor(ctx, u, today) }));
  const pastGrace = minutesOfDayIn(new Date(), settings.timezone) > hhmmToMinutes(settings.workStart) + settings.graceMinutes;
  const counts = {
    total: people.length, in: people.filter((p) => p.open).length,
    present: people.filter((p) => ['present', 'late', 'half'].includes(p.status)).length,
    late: people.filter((p) => p.status === 'late').length, leave: people.filter((p) => p.status === 'leave').length,
    notIn: people.filter((p) => p.status === 'pending').length,
  };
  const trend = dateRange(start, today).map((date) => {
    const t = { date, present: 0, late: 0, absent: 0, leave: 0, off: false, holiday: ctx.holidayMap.get(date)?.name || '' };
    let off = 0;
    for (const u of users) {
      const s = dayFor(ctx, u, date).status;
      if (s === 'present' || s === 'half') t.present += 1; else if (s === 'late') t.late += 1;
      else if (s === 'absent') t.absent += 1; else if (s === 'leave') t.leave += 1;
      else if (s === 'weekend' || s === 'holiday') off += 1;
    }
    t.off = users.length > 0 && off === users.length;
    return t;
  });
  const departments = {};
  for (const p of people) {
    const k = p.department || 'Unassigned';
    departments[k] ||= { name: k, total: 0, present: 0 };
    departments[k].total += 1;
    if (['present', 'late', 'half'].includes(p.status)) departments[k].present += 1;
  }
  const pending = db.leaves.filter((l) => l.status === 'pending' && userById(l.user)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return {
    today, serverTime: nowIso(), pastGrace,
    settings: { workStart: settings.workStart, workEnd: settings.workEnd, fullDayHours: settings.fullDayHours, graceMinutes: settings.graceMinutes, timezone: settings.timezone, companyName: settings.companyName },
    holidayToday: ctx.holidayMap.get(today)?.name || '', counts, people, trend,
    departments: Object.values(departments).sort((a, b) => b.total - a.total),
    pendingLeaves: pending.slice(0, 6).map(leaveOut), pendingLeaveCount: pending.length,
    upcomingLeaves: db.leaves.filter((l) => l.status === 'approved' && l.endDate >= today && l.startDate <= addDays(today, 14) && userById(l.user))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 6).map(leaveOut),
    upcomingHolidays: clone(db.holidays.filter((h) => h.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)),
    activity: clone(db.audit.slice(0, 8)),
  };
};

// users
const PROFILE = ['name', 'email', 'role', 'employeeCode', 'department', 'designation', 'phone', 'joinDate'];
const pickProfile = (b) => {
  const out = {};
  for (const f of PROFILE) if (b[f] !== undefined) out[f] = typeof b[f] === 'string' ? b[f].trim() : b[f];
  if (out.email) out.email = out.email.toLowerCase();
  if (out.role && !ROLES.includes(out.role)) fail(400, `Role must be one of ${ROLES.join(', ')}`);
  if (out.joinDate && !isValidDateStr(out.joinDate)) fail(400, 'Join date must be YYYY-MM-DD');
  if (out.email && !/^\S+@\S+\.\S+$/.test(out.email)) fail(400, 'Enter a valid email');
  return out;
};
const activeManagers = () => db.users.filter((u) => u.role === 'manager' && u.isActive).length;

H.listUsers = ({ query }) => {
  let list = db.users.filter((u) => (!query.role || u.role === query.role)
    && (query.status !== 'active' || u.isActive) && (query.status !== 'inactive' || !u.isActive)
    && (!query.department || u.department === query.department));
  if (query.q) {
    const n = String(query.q).toLowerCase();
    list = list.filter((u) => [u.name, u.email, u.employeeCode, u.department, u.designation].some((v) => String(v || '').toLowerCase().includes(n)));
  }
  return list.sort((a, b) => a.name.localeCompare(b.name)).map(safeUser);
};
H.departments = () => [...new Set(db.users.map((u) => u.department).filter(Boolean))].sort();
H.getUser = ({ params }) => { const u = userById(params.id); if (!u) fail(404, 'User not found'); return safeUser(u); };
H.createUser = ({ user, body }) => {
  const data = pickProfile(body);
  if (!data.name || !data.email) fail(400, 'Name and email are required');
  if (String(body.password || '').length < 6) fail(400, 'Password must be at least 6 characters');
  if (db.users.some((u) => u.email === data.email)) fail(409, 'A user with this email already exists');
  const u = stamp({ role: 'employee', employeeCode: '', department: '', designation: '', phone: '', joinDate: '', isActive: true, ...data, password: String(body.password) });
  db.users.push(u);
  audit(user, 'user.create', u.name, `Role: ${u.role}`);
  touch();
  return safeUser(u);
};
H.updateUser = ({ user, params, body }) => {
  const u = userById(params.id);
  if (!u) fail(404, 'User not found');
  const data = pickProfile(body);
  if (data.email && data.email !== u.email && db.users.some((x) => x.email === data.email)) fail(409, 'A user with this email already exists');
  if (u.role === 'manager' && data.role && data.role !== 'manager' && u.isActive && activeManagers() <= 1) fail(400, 'This is the only active manager. Promote someone else first.');
  const changed = Object.keys(data).filter((k) => String(u[k] ?? '') !== String(data[k] ?? ''));
  Object.assign(u, data, { updatedAt: nowIso() });
  if (body.password) {
    if (String(body.password).length < 6) fail(400, 'Password must be at least 6 characters');
    u.password = String(body.password);
    changed.push('password');
  }
  if (changed.length) audit(user, 'user.update', u.name, `Changed: ${changed.join(', ')}`);
  touch();
  return safeUser(u);
};
H.setActive = ({ user, params, body }) => {
  const u = userById(params.id);
  if (!u) fail(404, 'User not found');
  const isActive = !!body.isActive;
  if (u._id === user._id && !isActive) fail(400, 'You cannot deactivate your own account');
  if (!isActive && u.role === 'manager' && activeManagers() <= 1) fail(400, 'This is the only active manager');
  u.isActive = isActive;
  audit(user, isActive ? 'user.activate' : 'user.deactivate', u.name);
  touch();
  return safeUser(u);
};
H.deleteUser = ({ user, params }) => {
  const u = userById(params.id);
  if (!u) fail(404, 'User not found');
  if (u._id === user._id) fail(400, 'You cannot delete your own account');
  if (u.role === 'manager' && u.isActive && activeManagers() <= 1) fail(400, 'This is the only active manager');
  db.attendances = db.attendances.filter((r) => r.user !== u._id);
  db.leaves = db.leaves.filter((l) => l.user !== u._id);
  db.users = db.users.filter((x) => x !== u);
  audit(user, 'user.delete', u.name, 'Attendance and leave history removed');
  touch();
  return { message: 'User deleted' };
};

// leave
H.myLeaves = ({ user, query }) => {
  const year = Number(query.year) || Number(dateStrIn(S().timezone).slice(0, 4));
  return {
    year,
    leaves: db.leaves.filter((l) => l.user === user._id).sort((a, b) => b.startDate.localeCompare(a.startDate)).map((l) => ({ ...clone(l), reviewedBy: l.reviewedBy ? ref(l.reviewedBy, ['name']) : null })),
    balance: balanceFor(user._id, year),
  };
};
H.requestLeave = ({ user, body }) => {
  const { type, startDate, endDate, reason } = body;
  if (!LEAVE_TYPES.includes(type)) fail(400, 'Choose a leave type');
  if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) fail(400, 'Choose start and end dates');
  if (startDate > endDate) fail(400, 'End date must be on or after the start date');
  if (dateRange(startDate, endDate).length > 60) fail(400, 'A single request can cover at most 60 days');
  const overlap = db.leaves.find((l) => l.user === user._id && ['pending', 'approved'].includes(l.status) && l.startDate <= endDate && l.endDate >= startDate);
  if (overlap) fail(409, `This overlaps a ${overlap.status} request (${overlap.startDate} to ${overlap.endDate})`);
  const days = countWorkingDays(startDate, endDate);
  if (days === 0) fail(400, 'Those dates are all weekends or holidays');
  if (type !== 'unpaid') {
    const bal = balanceFor(user._id, startDate.slice(0, 4))[type];
    if (days > bal.remaining) fail(400, `Not enough ${type} leave: ${bal.remaining} day(s) left, ${days} requested`);
  }
  const l = stamp({ user: user._id, type, startDate, endDate, days, reason: clip(reason, 500), status: 'pending', reviewNote: '' });
  db.leaves.push(l);
  audit(user, 'leave.request', user.name, `${type}, ${startDate} to ${endDate} (${days}d)`);
  touch();
  return clone(l);
};
H.cancelLeave = ({ user, params }) => {
  const l = db.leaves.find((x) => x._id === params.id && x.user === user._id);
  if (!l) fail(404, 'Leave request not found');
  const today = dateStrIn(S().timezone);
  if (!(l.status === 'pending' || (l.status === 'approved' && l.startDate > today))) fail(400, 'Only pending or upcoming approved leave can be cancelled');
  l.status = 'cancelled';
  audit(user, 'leave.cancel', user.name, `${l.startDate} to ${l.endDate}`);
  touch();
  return clone(l);
};
H.listLeaves = ({ query }) => {
  const order = { approved: 0, cancelled: 1, pending: 2, rejected: 3 };
  return db.leaves.filter((l) => (!query.status || l.status === query.status) && userById(l.user))
    .sort((a, b) => (order[a.status] - order[b.status]) || b.startDate.localeCompare(a.startDate)).slice(0, 300).map(leaveOut);
};
H.reviewLeave = ({ user, params, body }) => {
  if (!['approved', 'rejected'].includes(body.status)) fail(400, 'Status must be approved or rejected');
  const l = db.leaves.find((x) => x._id === params.id);
  if (!l) fail(404, 'Leave request not found');
  if (l.status !== 'pending') fail(400, `This request is already ${l.status}`);
  Object.assign(l, { status: body.status, reviewNote: clip(body.note, 300), reviewedBy: user._id, reviewedAt: nowIso() });
  audit(user, `leave.${body.status === 'approved' ? 'approve' : 'reject'}`, userById(l.user)?.name, `${l.type}, ${l.startDate} to ${l.endDate}`);
  touch();
  return leaveOut(l);
};
H.userBalance = ({ params, query }) => balanceFor(params.userId, Number(query.year) || Number(dateStrIn(S().timezone).slice(0, 4)));

// holidays, settings, notices, audit
H.listHolidays = ({ query }) => clone(db.holidays.filter((h) => !/^\d{4}$/.test(query.year || '') || h.date.startsWith(query.year)).sort((a, b) => a.date.localeCompare(b.date)));
H.addHoliday = ({ user, body }) => {
  if (!isValidDateStr(body.date)) fail(400, 'Choose a date');
  if (!String(body.name || '').trim()) fail(400, 'Give the holiday a name');
  if (db.holidays.some((h) => h.date === body.date)) fail(409, 'That date is already in use');
  const h = stamp({ date: body.date, name: String(body.name).trim() });
  db.holidays.push(h);
  audit(user, 'holiday.add', h.name, h.date);
  touch();
  return clone(h);
};
H.removeHoliday = ({ user, params }) => {
  const h = db.holidays.find((x) => x._id === params.id);
  if (!h) fail(404, 'Holiday not found');
  db.holidays = db.holidays.filter((x) => x !== h);
  audit(user, 'holiday.delete', h.name, h.date);
  touch();
  return { message: 'Holiday removed' };
};
H.getSettings = () => clone(S());
H.updateSettings = ({ user, body: b }) => {
  const s = clone(S());
  const before = JSON.stringify(s);
  if (b.companyName !== undefined) s.companyName = String(b.companyName).trim() || 'HRPulse';
  if (b.timezone !== undefined) { try { new Intl.DateTimeFormat('en-US', { timeZone: b.timezone }); } catch { fail(400, 'Unknown timezone'); } s.timezone = b.timezone; }
  for (const k of ['workStart', 'workEnd']) if (b[k] !== undefined) { if (!isValidHHMM(b[k])) fail(400, `${k} must be HH:MM`); s[k] = b[k]; }
  for (const k of ['graceMinutes', 'fullDayHours', 'halfDayHours', 'autoSignOutHours']) {
    if (b[k] !== undefined) { const n = Number(b[k]); if (!Number.isFinite(n) || n < 0) fail(400, `${k} must be a positive number`); s[k] = n; }
  }
  if (b.weekendDays !== undefined) {
    if (!Array.isArray(b.weekendDays) || b.weekendDays.some((d) => ![0, 1, 2, 3, 4, 5, 6].includes(d))) fail(400, 'Invalid weekend days');
    s.weekendDays = [...new Set(b.weekendDays)].sort();
  }
  if (b.leaveAllowance) for (const t of ['annual', 'sick', 'casual']) if (b.leaveAllowance[t] !== undefined) s.leaveAllowance[t] = Math.max(0, Number(b.leaveAllowance[t]) || 0);
  if (s.halfDayHours > s.fullDayHours) fail(400, 'Half-day hours cannot exceed full-day hours');
  db.settings = s;
  if (JSON.stringify(s) !== before) audit(user, 'settings.update', s.companyName, 'working hours and rules');
  touch();
  return clone(s);
};
H.listAnnouncements = ({ user, query }) => {
  const today = dateStrIn(S().timezone);
  const items = [...db.announcements].sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || b.createdAt.localeCompare(a.createdAt))
    .map((a) => ({ ...clone(a), author: ref(a.author, ['name']) }));
  return query.all === '1' && user.role === 'manager' ? items : items.filter((a) => !a.expiresOn || a.expiresOn >= today).slice(0, 10);
};
H.addAnnouncement = ({ user, body }) => {
  if (!String(body.title || '').trim()) fail(400, 'Add a title');
  if (body.expiresOn && !isValidDateStr(body.expiresOn)) fail(400, 'Expiry must be a date');
  const a = stamp({ title: String(body.title).trim(), body: String(body.body || '').trim(), pinned: !!body.pinned, expiresOn: body.expiresOn || '', author: user._id });
  db.announcements.push(a);
  audit(user, 'announcement.post', a.title);
  touch();
  return clone(a);
};
H.removeAnnouncement = ({ user, params }) => {
  const a = db.announcements.find((x) => x._id === params.id);
  if (!a) fail(404, 'Announcement not found');
  db.announcements = db.announcements.filter((x) => x !== a);
  audit(user, 'announcement.delete', a.title);
  touch();
  return { message: 'Announcement removed' };
};
H.listAudit = ({ query }) => {
  const limit = Math.min(Number(query.limit) || 100, 500);
  const prefix = String(query.action || '').replace(/[^a-z.]/g, '');
  return clone(db.audit.filter((a) => !prefix || a.action.startsWith(prefix)).slice(0, limit));
};

// ---------------------------------------------------------------- router

const ROUTES = [
  ['POST', '/auth/login', 'public', H.login],
  ['GET', '/auth/me', 'user', H.me],
  ['PUT', '/auth/me', 'user', H.updateMe],
  ['PUT', '/auth/password', 'user', H.changePassword],
  ['POST', '/attendance/signin', 'user', H.signIn],
  ['POST', '/attendance/signout', 'user', H.signOut],
  ['GET', '/attendance/status', 'user', H.status],
  ['GET', '/attendance/me', 'user', H.myHistory],
  ['GET', '/attendance/records', 'manager', H.records],
  ['GET', '/attendance/export', 'manager', H.exportCsv],
  ['POST', '/attendance/manual', 'manager', H.manual],
  ['DELETE', '/attendance/:id', 'manager', H.removeRecord],
  ['GET', '/dashboard', 'manager', H.dashboard],
  ['GET', '/users', 'manager', H.listUsers],
  ['GET', '/users/departments', 'manager', H.departments],
  ['GET', '/users/:id', 'manager', H.getUser],
  ['POST', '/users', 'manager', H.createUser],
  ['PUT', '/users/:id', 'manager', H.updateUser],
  ['PATCH', '/users/:id/active', 'manager', H.setActive],
  ['DELETE', '/users/:id', 'manager', H.deleteUser],
  ['GET', '/leaves/mine', 'user', H.myLeaves],
  ['POST', '/leaves', 'user', H.requestLeave],
  ['PATCH', '/leaves/:id/cancel', 'user', H.cancelLeave],
  ['GET', '/leaves', 'manager', H.listLeaves],
  ['PATCH', '/leaves/:id/review', 'manager', H.reviewLeave],
  ['GET', '/leaves/balance/:userId', 'manager', H.userBalance],
  ['GET', '/holidays', 'user', H.listHolidays],
  ['POST', '/holidays', 'manager', H.addHoliday],
  ['DELETE', '/holidays/:id', 'manager', H.removeHoliday],
  ['GET', '/settings', 'manager', H.getSettings],
  ['PUT', '/settings', 'manager', H.updateSettings],
  ['GET', '/announcements', 'user', H.listAnnouncements],
  ['POST', '/announcements', 'manager', H.addAnnouncement],
  ['DELETE', '/announcements/:id', 'manager', H.removeAnnouncement],
  ['GET', '/audit', 'manager', H.listAudit],
].map(([method, path, access, fn]) => {
  const names = [];
  const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; })}$`);
  return { method, re, names, access, fn };
});

/** Handle one API call. Returns { status, data }. */
export const handle = ({ method, path, query = {}, body = {}, token = '' }) => {
  load();
  const m = method.toUpperCase();
  const clean = `/${path.replace(/^\/+/, '').replace(/^api\//, '').split('?')[0]}`.replace(/\/+$/, '') || '/';
  try {
    const route = ROUTES.find((r) => r.method === m && r.re.test(clean));
    if (!route) fail(404, `Route not found: ${m} /api${clean}`);
    const match = clean.match(route.re);
    const params = Object.fromEntries(route.names.map((n, i) => [n, decodeURIComponent(match[i + 1])]));
    let user = null;
    if (route.access !== 'public') {
      const id = String(token).startsWith('demo.') ? token.slice(5) : '';
      user = userById(id);
      if (!user) fail(401, 'Session expired. Sign in again.');
      if (!user.isActive) fail(403, 'Your account has been deactivated. Contact your manager.');
      if (route.access === 'manager' && user.role !== 'manager') fail(403, 'You do not have access to this');
    }
    const data = route.fn({ params, query, body: body || {}, user });
    return { status: m === 'POST' && !['/auth/login', '/attendance/signout'].includes(clean) ? 201 : 200, data };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, data: { message: err.message } };
    console.error('[demo api]', err);
    return { status: 500, data: { message: 'Something went wrong in the demo' } };
  }
};

// ---------------------------------------------------------------- sample data

function seed() {
  const settings = clone(DEFAULT_SETTINGS);
  const tz = settings.timezone;
  const today = dateStrIn(tz);
  const start = addDays(today, -42);
  const d = { v: 1, seededOn: today, dirty: false, settings, users: [], attendances: [], leaves: [], holidays: [], announcements: [], audit: [] };

  const people = [
    { name: 'Manager', email: 'manager@test.com', role: 'manager', department: 'Management', designation: 'Office Manager', employeeCode: 'MGR-001', punctual: 0.9 },
    { name: 'Ayesha Khan', email: 'ayesha@test.com', role: 'employee', department: 'Operations', designation: 'Operations Lead', employeeCode: 'EMP-001', punctual: 0.92 },
    { name: 'Bilal Ahmed', email: 'bilal@test.com', role: 'developer', department: 'Engineering', designation: 'Backend Developer', employeeCode: 'EMP-002', punctual: 0.7 },
    { name: 'Sara Malik', email: 'sara@test.com', role: 'developer', department: 'Engineering', designation: 'Frontend Developer', employeeCode: 'EMP-003', punctual: 0.85 },
    { name: 'Usman Tariq', email: 'usman@test.com', role: 'employee', department: 'Sales', designation: 'Account Executive', employeeCode: 'EMP-004', punctual: 0.6 },
    { name: 'Hina Raza', email: 'hina@test.com', role: 'employee', department: 'Finance', designation: 'Accountant', employeeCode: 'EMP-005', punctual: 0.95 },
    { name: 'Zain Abbas', email: 'zain@test.com', role: 'developer', department: 'Engineering', designation: 'QA Engineer', employeeCode: 'EMP-006', punctual: 0.8 },
  ];
  const byEmail = {};
  for (const { punctual, ...p } of people) {
    const u = stamp({ ...p, password: '123456', phone: '', joinDate: p.role === 'manager' ? '' : start, isActive: true });
    d.users.push(u);
    byEmail[p.email] = { u, punctual };
  }
  const mgr = byEmail['manager@test.com'].u;

  // A next-weekday helper so demo leave and holidays never land on a weekend.
  const nextWeekday = (from, n) => { let x = addDays(from, n); while (settings.weekendDays.includes(weekdayOf(x))) x = addDays(x, 1); return x; };
  d.holidays.push(stamp({ date: nextWeekday(today, -17), name: 'Company day off' }));
  d.holidays.push(stamp({ date: nextWeekday(today, 12), name: 'Founders day' }));
  const holidays = new Set(d.holidays.map((h) => h.date));

  // Deterministic-looking but varied history.
  let seedNum = 7;
  const rnd = () => { seedNum = (seedNum * 16807) % 2147483647; return (seedNum - 1) / 2147483646; };
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const now = new Date();
  for (const { u, punctual } of Object.values(byEmail)) {
    for (const date of dateRange(start, today)) {
      if (settings.weekendDays.includes(weekdayOf(date)) || holidays.has(date)) continue;
      if (date === today && rnd() < 0.2) continue; // not in yet
      if (date !== today && rnd() < 0.05) continue; // absent
      const inMin = rnd() < punctual ? between(8 * 60 + 40, 9 * 60 + 12) : between(9 * 60 + 20, 10 * 60 + 20);
      const signIn = zonedToDate(date, hhmm(inMin), tz);
      if (signIn > now) continue;
      // Past days always have a sign-out; today only once that time has passed.
      const outMin = date !== today && rnd() < 0.05 ? inMin + between(150, 220) : inMin + between(470, 560);
      let signOut = zonedToDate(date, hhmm(Math.min(outMin, 23 * 60)), tz);
      if (date === today && signOut > now) signOut = null;
      d.attendances.push(stamp({
        user: u._id, date, signInTime: signIn.toISOString(), signOutTime: signOut ? signOut.toISOString() : null,
        lateMinutes: lateMinutesFor(signIn, settings), signInNote: '', signOutNote: '', managerNote: '', source: 'self', autoSignedOut: false,
      }));
    }
  }

  const leave = (email, type, from, to, reason, status = 'pending') => {
    const s = nextWeekday(today, from);
    const e = to === from ? s : nextWeekday(s, to - from);
    const days = dateRange(s, e).filter((x) => !settings.weekendDays.includes(weekdayOf(x)) && !holidays.has(x)).length;
    d.leaves.push(stamp({
      user: byEmail[email].u._id, type, startDate: s, endDate: e, days, reason, status, reviewNote: status === 'approved' ? 'Approved' : '',
      ...(status === 'approved' ? { reviewedBy: mgr._id, reviewedAt: nowIso() } : {}),
    }));
  };
  leave('usman@test.com', 'casual', 3, 4, 'Family wedding in Lahore');
  leave('zain@test.com', 'annual', 15, 17, 'Visiting family in Karachi');
  leave('hina@test.com', 'sick', 1, 1, 'Doctor appointment', 'approved');

  d.announcements.push(stamp({ title: 'Quarter-end reports due Friday', body: 'Please submit your timesheets and expense claims before 5 pm on Friday.', pinned: true, author: mgr._id, expiresOn: '' }));
  d.announcements.push(stamp({ title: 'Welcome to the HRPulse demo', body: 'Everything you change here is saved only in this browser. Use "Reset demo data" on the sign-in page to start over.', pinned: false, author: mgr._id, expiresOn: '' }));

  const t = (minsAgo) => new Date(Date.now() - minsAgo * 60000).toISOString();
  d.audit = [
    { action: 'leave.request', actorName: 'Zain Abbas', targetName: 'Zain Abbas', details: 'annual leave', createdAt: t(35) },
    { action: 'leave.approve', actorName: 'Manager', targetName: 'Hina Raza', details: 'sick leave', createdAt: t(80) },
    { action: 'attendance.edit', actorName: 'Manager', targetName: 'Bilal Ahmed', details: 'Forgot to sign out', createdAt: t(150) },
    { action: 'holiday.add', actorName: 'Manager', targetName: 'Founders day', details: '', createdAt: t(300) },
    { action: 'announcement.post', actorName: 'Manager', targetName: 'Quarter-end reports due Friday', details: '', createdAt: t(600) },
  ].map((a) => ({ _id: oid(), actor: mgr._id, ...a }));
  return d;
}

const User = require('../models/User');
const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');
const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');
const closeExpiredSessions = require('../utils/autoSignOut');
const { loadRange } = require('../utils/context');
const { computeDay } = require('../utils/dayStatus');
const { dateStrIn, addDays, dateRange, minutesOfDayIn, hhmmToMinutes } = require('../utils/time');

const managerDashboard = async (req, res) => {
  const settings = await Settings.get();
  await closeExpiredSessions(settings);
  const today = dateStrIn(settings.timezone);
  const start = addDays(today, -13);
  const users = await User.find({ isActive: true }).sort({ name: 1 });
  const ctx = await loadRange({ start, end: today, userIds: users.map((u) => u._id) });

  const dayFor = (u, date) => computeDay({
    date, record: ctx.recordFor(u._id, date), leave: ctx.leaveFor(u._id, date),
    holiday: ctx.holidayMap.get(date), settings, today, joinDate: u.joinDate,
  });

  const people = users.map((u) => ({
    id: u._id, name: u.name, role: u.role, department: u.department, designation: u.designation, ...dayFor(u, today),
  }));

  const nowMin = minutesOfDayIn(new Date(), settings.timezone);
  const pastGrace = nowMin > hhmmToMinutes(settings.workStart) + settings.graceMinutes;

  const counts = {
    total: people.length,
    in: people.filter((p) => p.open).length,
    present: people.filter((p) => ['present', 'late', 'half'].includes(p.status)).length,
    late: people.filter((p) => p.status === 'late').length,
    leave: people.filter((p) => p.status === 'leave').length,
    notIn: people.filter((p) => p.status === 'pending').length,
  };

  const trend = dateRange(start, today).map((date) => {
    const t = { date, present: 0, late: 0, absent: 0, leave: 0, off: false, holiday: ctx.holidayMap.get(date)?.name || '' };
    let offCount = 0;
    for (const u of users) {
      const d = dayFor(u, date);
      if (d.status === 'present' || d.status === 'half') t.present += 1;
      else if (d.status === 'late') t.late += 1;
      else if (d.status === 'absent') t.absent += 1;
      else if (d.status === 'leave') t.leave += 1;
      else if (d.status === 'weekend' || d.status === 'holiday') offCount += 1;
    }
    t.off = users.length > 0 && offCount === users.length;
    return t;
  });

  const departments = {};
  for (const p of people) {
    const k = p.department || 'Unassigned';
    departments[k] = departments[k] || { name: k, total: 0, present: 0 };
    departments[k].total += 1;
    if (['present', 'late', 'half'].includes(p.status)) departments[k].present += 1;
  }

  const [pendingLeaves, upcomingHolidays, activity, upcomingLeaves] = await Promise.all([
    Leave.find({ status: 'pending' }).sort({ startDate: 1 }).limit(6).populate('user', 'name role'),
    Holiday.find({ date: { $gte: today } }).sort({ date: 1 }).limit(4),
    AuditLog.find().sort({ createdAt: -1 }).limit(8),
    Leave.find({ status: 'approved', endDate: { $gte: today }, startDate: { $lte: addDays(today, 14) } }).sort({ startDate: 1 }).limit(6).populate('user', 'name'),
  ]);
  const pendingLeaveCount = await Leave.countDocuments({ status: 'pending' });

  res.json({
    today,
    serverTime: new Date(),
    pastGrace,
    settings: { workStart: settings.workStart, workEnd: settings.workEnd, fullDayHours: settings.fullDayHours, graceMinutes: settings.graceMinutes, timezone: settings.timezone, companyName: settings.companyName },
    holidayToday: ctx.holidayMap.get(today)?.name || '',
    counts,
    people,
    trend,
    departments: Object.values(departments).sort((a, b) => b.total - a.total),
    pendingLeaves: pendingLeaves.filter((l) => l.user),
    pendingLeaveCount,
    upcomingLeaves: upcomingLeaves.filter((l) => l.user),
    upcomingHolidays,
    activity,
  });
};

module.exports = { managerDashboard };

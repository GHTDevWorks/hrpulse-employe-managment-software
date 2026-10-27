const Settings = require('../models/Settings');
const Holiday = require('../models/Holiday');
const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');
const { dateStrIn } = require('./time');
const { buildLeaveIndex } = require('./dayStatus');

// Load everything needed to compute day statuses for a set of users over [start, end].
const loadRange = async ({ start, end, userIds }) => {
  const settings = await Settings.get();
  const today = dateStrIn(settings.timezone);
  const userFilter = userIds ? { user: { $in: userIds } } : {};

  const [holidays, leaves, records] = await Promise.all([
    Holiday.find({ date: { $gte: start, $lte: end } }),
    Leave.find({ ...userFilter, status: 'approved', startDate: { $lte: end }, endDate: { $gte: start } }),
    Attendance.find({ ...userFilter, date: { $gte: start, $lte: end } }),
  ]);

  const holidayMap = new Map(holidays.map((h) => [h.date, h]));
  const leavesByUser = new Map();
  for (const l of leaves) {
    const k = String(l.user);
    if (!leavesByUser.has(k)) leavesByUser.set(k, []);
    leavesByUser.get(k).push(l);
  }
  const leaveIdx = new Map([...leavesByUser].map(([k, v]) => [k, buildLeaveIndex(v)]));
  const recordMap = new Map(records.map((r) => [`${r.user}|${r.date}`, r]));

  return {
    settings,
    today,
    holidayMap,
    recordFor: (userId, date) => recordMap.get(`${userId}|${date}`),
    leaveFor: (userId, date) => leaveIdx.get(String(userId))?.get(date),
  };
};

module.exports = { loadRange };

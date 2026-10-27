const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');

// Close any session left open longer than the configured limit.
const closeExpiredSessions = async (settings) => {
  const s = settings || (await Settings.get());
  const limitMs = s.autoSignOutHours * 3600 * 1000;
  const cutoff = new Date(Date.now() - limitMs);
  const open = await Attendance.find({ signOutTime: null, signInTime: { $lte: cutoff } });
  for (const r of open) {
    r.signOutTime = new Date(new Date(r.signInTime).getTime() + limitMs);
    r.autoSignedOut = true;
    await r.save();
  }
  return open.length;
};

module.exports = closeExpiredSessions;

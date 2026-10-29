/*
 * One-time migration from HRPulse v1, where attendance lived inside each user document
 * (users[].attendance[]). Copies every entry into the new `attendances` collection and
 * removes the old array. Safe to run more than once: existing (user, date) pairs are skipped.
 */
require('../config/env');
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');
const { lateMinutesFor } = require('../controllers/attendanceController');

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const settings = await Settings.get();
  const users = mongoose.connection.collection('users');
  const cursor = users.find({ 'attendance.0': { $exists: true } });
  let copied = 0;
  let skipped = 0;
  let people = 0;
  for await (const u of cursor) {
    people += 1;
    for (const a of u.attendance || []) {
      if (!a.date || !a.signInTime) { skipped += 1; continue; }
      const exists = await Attendance.exists({ user: u._id, date: a.date });
      if (exists) { skipped += 1; continue; }
      await Attendance.create({
        user: u._id, date: a.date, signInTime: a.signInTime, signOutTime: a.signOutTime || null,
        lateMinutes: lateMinutesFor(new Date(a.signInTime), settings), source: 'migrated',
      });
      copied += 1;
    }
    await users.updateOne({ _id: u._id }, { $unset: { attendance: '' }});
    await users.updateOne({ _id: u._id, isActive: { $exists: false } }, { $set: { isActive: true } });
  }
  await users.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
  await users.updateMany({}, [{ $set: { email: { $toLower: '$email' } } }]).catch(() => {});
  console.log(`Migrated ${copied} records from ${people} people (${skipped} skipped).`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

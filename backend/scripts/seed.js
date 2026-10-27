/* Creates the first manager account. With --demo, also adds sample people, holidays and 6 weeks of history. */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');
const Announcement = require('../models/Announcement');
const Settings = require('../models/Settings');
const { dateStrIn, addDays, dateRange, weekdayOf, zonedToDate } = require('../utils/time');
const { lateMinutesFor } = require('../controllers/attendanceController');

const MANAGER = { name: 'Manager', email: process.env.SEED_EMAIL || 'manager@test.com', password: process.env.SEED_PASSWORD || '123456', role: 'manager' };

const demoPeople = [
  { name: 'Ayesha Khan', email: 'ayesha@test.com', role: 'employee', department: 'Operations', designation: 'Operations Lead', employeeCode: 'EMP-001', punctual: 0.92 },
  { name: 'Bilal Ahmed', email: 'bilal@test.com', role: 'developer', department: 'Engineering', designation: 'Backend Developer', employeeCode: 'EMP-002', punctual: 0.7 },
  { name: 'Sara Malik', email: 'sara@test.com', role: 'developer', department: 'Engineering', designation: 'Frontend Developer', employeeCode: 'EMP-003', punctual: 0.85 },
  { name: 'Usman Tariq', email: 'usman@test.com', role: 'employee', department: 'Sales', designation: 'Account Executive', employeeCode: 'EMP-004', punctual: 0.6 },
  { name: 'Hina Raza', email: 'hina@test.com', role: 'employee', department: 'Finance', designation: 'Accountant', employeeCode: 'EMP-005', punctual: 0.95 },
  { name: 'Zain Abbas', email: 'zain@test.com', role: 'developer', department: 'Engineering', designation: 'QA Engineer', employeeCode: 'EMP-006', punctual: 0.8 },
];

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const settings = await Settings.get();
  let manager = await User.findOne({ email: MANAGER.email });
  if (!manager) {
    manager = await User.create({ ...MANAGER, department: 'Management', designation: 'Office Manager', employeeCode: 'MGR-001' });
    console.log(`Manager created: ${MANAGER.email} / ${MANAGER.password}`);
  } else console.log('Manager already exists');

  if (process.argv.includes('--demo')) {
    const tz = settings.timezone;
    const today = dateStrIn(tz);
    const start = addDays(today, -42);
    const holidayDate = addDays(today, -17);
    if (!(await Holiday.findOne({ date: holidayDate }))) await Holiday.create({ date: holidayDate, name: 'Company day off' });
    if (!(await Holiday.findOne({ date: addDays(today, 12) }))) await Holiday.create({ date: addDays(today, 12), name: 'Founders day' });

    const all = [{ doc: manager, punctual: 0.9 }];
    for (const p of demoPeople) {
      let u = await User.findOne({ email: p.email });
      if (!u) u = await User.create({ ...p, password: '123456', joinDate: start });
      all.push({ doc: u, punctual: p.punctual });
    }
    const holidays = new Set((await Holiday.find()).map((h) => h.date));
    let made = 0;
    for (const { doc, punctual } of all) {
      if (await Attendance.exists({ user: doc._id })) continue;
      for (const date of dateRange(start, today)) {
        if (settings.weekendDays.includes(weekdayOf(date)) || holidays.has(date)) continue;
        if (date === today && Math.random() < 0.35) continue; // not in yet
        if (date !== today && Math.random() < 0.06) continue; // absent
        const inMin = Math.random() < punctual ? rand(8 * 60 + 40, 9 * 60 + 12) : rand(9 * 60 + 20, 10 * 60 + 30);
        const signInTime = zonedToDate(date, hhmm(inMin), tz);
        if (signInTime > new Date()) continue;
        let signOutTime = null;
        if (date !== today) {
          const outMin = Math.random() < 0.05 ? inMin + rand(150, 220) : inMin + rand(470, 560);
          signOutTime = zonedToDate(date, hhmm(Math.min(outMin, 23 * 60)), tz);
        }
        await Attendance.create({ user: doc._id, date, signInTime, signOutTime, lateMinutes: lateMinutesFor(signInTime, settings), source: 'self' });
        made += 1;
      }
    }
    const usman = all.find((a) => a.doc.email === 'usman@test.com')?.doc;
    const hina = all.find((a) => a.doc.email === 'hina@test.com')?.doc;
    if (usman && !(await Leave.exists({ user: usman._id }))) {
      await Leave.create({ user: usman._id, type: 'casual', startDate: addDays(today, 3), endDate: addDays(today, 4), days: 2, reason: 'Family wedding in Lahore' });
    }
    if (hina && !(await Leave.exists({ user: hina._id }))) {
      await Leave.create({ user: hina._id, type: 'sick', startDate: addDays(today, 1), endDate: addDays(today, 1), days: 1, reason: 'Doctor appointment', status: 'approved', reviewedBy: manager._id, reviewedAt: new Date() });
    }
    if (!(await Announcement.exists({}))) {
      await Announcement.create({ title: 'Quarter-end reports due Friday', body: 'Please submit your timesheets and expense claims before 5 pm on Friday.', pinned: true, author: manager._id });
    }
    console.log(`Demo data ready (${made} attendance records). All demo passwords: 123456`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

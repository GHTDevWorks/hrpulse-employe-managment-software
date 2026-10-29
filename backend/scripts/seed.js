/* Creates the first manager account. With --demo, also adds sample people, holidays and 6 weeks of history. */
require('../config/env');
const mongoose = require('mongoose');
const User = require('../models/User');
const seedDemoData = require('../utils/demoData');

const MANAGER = { name: 'Manager', email: process.env.SEED_EMAIL || 'manager@test.com', password: process.env.SEED_PASSWORD || '123456', role: 'manager' };

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  let manager = await User.findOne({ email: MANAGER.email });
  if (!manager) {
    manager = await User.create({ ...MANAGER, department: 'Management', designation: 'Office Manager', employeeCode: 'MGR-001' });
    console.log(`Manager created: ${MANAGER.email} / ${MANAGER.password}`);
  } else console.log('Manager already exists');

  if (process.argv.includes('--demo')) await seedDemoData(manager);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

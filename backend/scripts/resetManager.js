/* Creates the manager account, or resets its password if it already exists.
 * Usage: npm run reset-manager            -> manager@test.com / 123456
 *        npm run reset-manager -- you@company.com newPassword
 */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../models/User');

const email = (process.argv[2] || process.env.SEED_EMAIL || 'manager@test.com').toLowerCase();
const password = process.argv[3] || process.env.SEED_PASSWORD || '123456';

(async () => {
  if (password.length < 6) throw new Error('Password must be at least 6 characters');
  await mongoose.connect(process.env.MONGO_URI);
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ name: 'Manager', email, role: 'manager', designation: 'Office Manager' });
    console.log(`Creating manager ${email}`);
  } else {
    console.log(`Resetting password for ${email}`);
  }
  user.password = password;
  user.role = 'manager';
  user.isActive = true;
  await user.save();
  console.log(`Done. Sign in with ${email} / ${password}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });

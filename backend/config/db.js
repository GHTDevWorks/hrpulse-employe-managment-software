const mongoose = require('mongoose');

// One shared connection. On Vercel the function is reused between requests,
// so we connect once and reuse the same promise.
let connecting = null;

// First start on an empty database: create the manager account so the app can be used right away.
const ensureManager = async () => {
  const User = require('../models/User');
  if ((await User.estimatedDocumentCount()) > 0) return;
  const email = (process.env.SEED_EMAIL || 'manager@test.com').toLowerCase();
  const password = process.env.SEED_PASSWORD || '123456';
  const manager = await User.create({ name: 'Manager', email, password, role: 'manager', department: 'Management', designation: 'Office Manager', employeeCode: 'MGR-001' });
  console.log(`Empty database: created manager ${email}`);
  // Set SEED_DEMO=true to also add sample people and history on first start (handy for a public demo).
  if (process.env.SEED_DEMO === 'true') await require('../utils/demoData')(manager);
};

const connectDB = () => {
  if (mongoose.connection.readyState === 1 && !connecting) return Promise.resolve(mongoose.connection);
  if (!process.env.MONGO_URI) return Promise.reject(new Error('MONGO_URI is not set'));
  if (!connecting) {
    connecting = mongoose
      .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, dbName: process.env.MONGO_DB_NAME })
      .then(async (conn) => {
        console.log(`MongoDB connected: ${conn.connection.host}`);
        try { await ensureManager(); } catch (e) { console.error('Could not create the first manager:', e.message); }
        return conn.connection;
      })
      .catch((err) => {
        connecting = null; // allow a retry on the next request
        throw err;
      });
  }
  return connecting;
};

module.exports = connectDB;

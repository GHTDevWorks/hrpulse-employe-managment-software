const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Settings = require('../models/Settings');
const audit = require('../utils/audit');
const { fail } = require('../utils/httpError');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const login = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) fail(400, 'Enter your email and password');

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) fail(401, 'Email or password is incorrect');
  if (!user.isActive) fail(403, 'Your account has been deactivated. Contact your manager.');

  user.lastLoginAt = new Date();
  await user.save();

  const { timezone, companyName } = await Settings.get();
  res.json({ user: { ...user.toSafeJSON(), timezone, companyName }, token: signToken(user._id) });
};

const withOrg = async (user) => {
  const { timezone, companyName } = await Settings.get();
  return { ...user.toSafeJSON(), timezone, companyName };
};

const me = async (req, res) => res.json(await withOrg(req.user));

const updateMe = async (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined) {
    if (!String(name).trim()) fail(400, 'Name cannot be empty');
    req.user.name = String(name).trim();
  }
  if (phone !== undefined) req.user.phone = String(phone).trim();
  await req.user.save();
  res.json(await withOrg(req.user));
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 6) fail(400, 'New password must be at least 6 characters');
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(String(currentPassword || '')))) fail(400, 'Current password is incorrect');
  user.password = String(newPassword);
  await user.save();
  await audit(req.user, 'password.change', req.user.name);
  res.json({ message: 'Password updated' });
};

module.exports = { login, me, updateMe, changePassword };

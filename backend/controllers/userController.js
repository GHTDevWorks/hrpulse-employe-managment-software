const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const { ROLES } = require('../models/User');
const audit = require('../utils/audit');
const { fail } = require('../utils/httpError');
const { isValidDateStr } = require('../utils/time');

const PROFILE_FIELDS = ['name', 'email', 'role', 'employeeCode', 'department', 'designation', 'phone', 'joinDate'];

const pickProfile = (body) => {
  const out = {};
  for (const f of PROFILE_FIELDS) if (body[f] !== undefined) out[f] = typeof body[f] === 'string' ? body[f].trim() : body[f];
  if (out.email) out.email = out.email.toLowerCase();
  if (out.role && !ROLES.includes(out.role)) fail(400, `Role must be one of ${ROLES.join(', ')}`);
  if (out.joinDate && !isValidDateStr(out.joinDate)) fail(400, 'Join date must be YYYY-MM-DD');
  if (out.email && !/^\S+@\S+\.\S+$/.test(out.email)) fail(400, 'Enter a valid email');
  return out;
};

const activeManagerCount = () => User.countDocuments({ role: 'manager', isActive: true });

const listUsers = async (req, res) => {
  const { q, role, status, department } = req.query;
  const filter = {};
  if (role && ROLES.includes(role)) filter.role = role;
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  if (department) filter.department = department;
  let users = await User.find(filter).sort({ name: 1 });
  if (q) {
    const needle = String(q).toLowerCase();
    users = users.filter((u) => [u.name, u.email, u.employeeCode, u.department, u.designation]
      .some((v) => String(v || '').toLowerCase().includes(needle)));
  }
  res.json(users.map((u) => u.toSafeJSON()));
};

const getUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) fail(404, 'User not found');
  res.json(user.toSafeJSON());
};

const createUser = async (req, res) => {
  const data = pickProfile(req.body);
  if (!data.name || !data.email) fail(400, 'Name and email are required');
  const password = String(req.body.password || '');
  if (password.length < 6) fail(400, 'Password must be at least 6 characters');
  if (await User.findOne({ email: data.email })) fail(409, 'A user with this email already exists');
  const user = await User.create({ ...data, password });
  await audit(req.user, 'user.create', user.name, `Role: ${user.role}`);
  res.status(201).json(user.toSafeJSON());
};

const updateUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) fail(404, 'User not found');
  const data = pickProfile(req.body);

  if (data.email && data.email !== user.email && (await User.findOne({ email: data.email }))) {
    fail(409, 'A user with this email already exists');
  }
  if (user.role === 'manager' && data.role && data.role !== 'manager' && user.isActive && (await activeManagerCount()) <= 1) {
    fail(400, 'This is the only active manager. Promote someone else first.');
  }
  const changed = Object.keys(data).filter((k) => String(user[k] ?? '') !== String(data[k] ?? ''));
  Object.assign(user, data);
  if (req.body.password) {
    if (String(req.body.password).length < 6) fail(400, 'Password must be at least 6 characters');
    user.password = String(req.body.password);
    changed.push('password');
  }
  await user.save();
  if (changed.length) await audit(req.user, 'user.update', user.name, `Changed: ${changed.join(', ')}`);
  res.json(user.toSafeJSON());
};

const setActive = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) fail(404, 'User not found');
  const isActive = !!req.body.isActive;
  if (String(user._id) === String(req.user._id) && !isActive) fail(400, 'You cannot deactivate your own account');
  if (!isActive && user.role === 'manager' && (await activeManagerCount()) <= 1) fail(400, 'This is the only active manager');
  user.isActive = isActive;
  await user.save();
  await audit(req.user, isActive ? 'user.activate' : 'user.deactivate', user.name);
  res.json(user.toSafeJSON());
};

const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) fail(404, 'User not found');
  if (String(user._id) === String(req.user._id)) fail(400, 'You cannot delete your own account');
  if (user.role === 'manager' && user.isActive && (await activeManagerCount()) <= 1) fail(400, 'This is the only active manager');
  await Promise.all([Attendance.deleteMany({ user: user._id }), Leave.deleteMany({ user: user._id })]);
  await user.deleteOne();
  await audit(req.user, 'user.delete', user.name, 'Attendance and leave history removed');
  res.json({ message: 'User deleted' });
};

const departments = async (req, res) => {
  const list = await User.distinct('department');
  res.json(list.filter(Boolean).sort());
};

module.exports = { listUsers, getUser, createUser, updateUser, setActive, deleteUser, departments };

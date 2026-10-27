const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');
const Settings = require('../models/Settings');
const { LEAVE_TYPES } = require('../models/Leave');
const audit = require('../utils/audit');
const { fail } = require('../utils/httpError');
const { isValidDateStr, dateRange, weekdayOf, dateStrIn } = require('../utils/time');

const countWorkingDays = async (start, end, settings) => {
  const holidays = new Set((await Holiday.find({ date: { $gte: start, $lte: end } })).map((h) => h.date));
  return dateRange(start, end).filter((d) => !settings.weekendDays.includes(weekdayOf(d)) && !holidays.has(d)).length;
};

const balanceFor = async (userId, settings, year) => {
  const leaves = await Leave.find({ user: userId, status: { $in: ['approved', 'pending'] }, startDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } });
  const out = {};
  for (const t of LEAVE_TYPES) {
    const allowance = t === 'unpaid' ? null : settings.leaveAllowance?.[t] ?? 0;
    const used = leaves.filter((l) => l.type === t && l.status === 'approved').reduce((a, l) => a + l.days, 0);
    const pending = leaves.filter((l) => l.type === t && l.status === 'pending').reduce((a, l) => a + l.days, 0);
    out[t] = { allowance, used, pending, remaining: allowance === null ? null : allowance - used - pending };
  }
  return out;
};

const myLeaves = async (req, res) => {
  const settings = await Settings.get();
  const year = Number(req.query.year) || Number(dateStrIn(settings.timezone).slice(0, 4));
  const [leaves, balance] = await Promise.all([
    Leave.find({ user: req.user._id }).sort({ startDate: -1 }).populate('reviewedBy', 'name'),
    balanceFor(req.user._id, settings, year),
  ]);
  res.json({ year, leaves, balance });
};

const requestLeave = async (req, res) => {
  const { type, startDate, endDate, reason } = req.body;
  if (!LEAVE_TYPES.includes(type)) fail(400, 'Choose a leave type');
  if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) fail(400, 'Choose start and end dates');
  if (startDate > endDate) fail(400, 'End date must be on or after the start date');
  if (dateRange(startDate, endDate).length > 60) fail(400, 'A single request can cover at most 60 days');

  const settings = await Settings.get();
  const overlap = await Leave.findOne({
    user: req.user._id, status: { $in: ['pending', 'approved'] }, startDate: { $lte: endDate }, endDate: { $gte: startDate },
  });
  if (overlap) fail(409, `This overlaps a ${overlap.status} request (${overlap.startDate} to ${overlap.endDate})`);

  const days = await countWorkingDays(startDate, endDate, settings);
  if (days === 0) fail(400, 'Those dates are all weekends or holidays');

  if (type !== 'unpaid') {
    const bal = (await balanceFor(req.user._id, settings, startDate.slice(0, 4)))[type];
    if (days > bal.remaining) fail(400, `Not enough ${type} leave: ${bal.remaining} day(s) left, ${days} requested`);
  }

  const leave = await Leave.create({ user: req.user._id, type, startDate, endDate, days, reason: String(reason || '').trim().slice(0, 500) });
  await audit(req.user, 'leave.request', req.user.name, `${type}, ${startDate} to ${endDate} (${days}d)`);
  res.status(201).json(leave);
};

const cancelLeave = async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave || String(leave.user) !== String(req.user._id)) fail(404, 'Leave request not found');
  const settings = await Settings.get();
  const today = dateStrIn(settings.timezone);
  if (leave.status === 'pending' || (leave.status === 'approved' && leave.startDate > today)) {
    leave.status = 'cancelled';
    await leave.save();
    await audit(req.user, 'leave.cancel', req.user.name, `${leave.startDate} to ${leave.endDate}`);
    return res.json(leave);
  }
  return fail(400, 'Only pending or upcoming approved leave can be cancelled');
};

const listLeaves = async (req, res) => {
  const filter = {};
  if (['pending', 'approved', 'rejected', 'cancelled'].includes(req.query.status)) filter.status = req.query.status;
  const leaves = await Leave.find(filter)
    .sort({ status: 1, startDate: -1 })
    .limit(300)
    .populate('user', 'name role department')
    .populate('reviewedBy', 'name');
  res.json(leaves.filter((l) => l.user));
};

const reviewLeave = async (req, res) => {
  const { status, note } = req.body;
  if (!['approved', 'rejected'].includes(status)) fail(400, 'Status must be approved or rejected');
  const leave = await Leave.findById(req.params.id).populate('user', 'name');
  if (!leave) fail(404, 'Leave request not found');
  if (leave.status !== 'pending') fail(400, `This request is already ${leave.status}`);
  leave.status = status;
  leave.reviewNote = String(note || '').trim().slice(0, 300);
  leave.reviewedBy = req.user._id;
  leave.reviewedAt = new Date();
  await leave.save();
  await audit(req.user, `leave.${status === 'approved' ? 'approve' : 'reject'}`, leave.user?.name, `${leave.type}, ${leave.startDate} to ${leave.endDate}`);
  res.json(leave);
};

const userBalance = async (req, res) => {
  const settings = await Settings.get();
  const year = Number(req.query.year) || Number(dateStrIn(settings.timezone).slice(0, 4));
  res.json(await balanceFor(req.params.userId, settings, year));
};

module.exports = { myLeaves, requestLeave, cancelLeave, listLeaves, reviewLeave, userBalance, countWorkingDays };

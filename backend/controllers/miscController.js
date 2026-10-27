const Holiday = require('../models/Holiday');
const Settings = require('../models/Settings');
const Announcement = require('../models/Announcement');
const AuditLog = require('../models/AuditLog');
const audit = require('../utils/audit');
const { fail } = require('../utils/httpError');
const { isValidDateStr, isValidHHMM, dateStrIn } = require('../utils/time');

// ----- holidays -----
const listHolidays = async (req, res) => {
  const year = req.query.year;
  const filter = /^\d{4}$/.test(year || '') ? { date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } } : {};
  res.json(await Holiday.find(filter).sort({ date: 1 }));
};

const addHoliday = async (req, res) => {
  const { date, name } = req.body;
  if (!isValidDateStr(date)) fail(400, 'Choose a date');
  if (!String(name || '').trim()) fail(400, 'Give the holiday a name');
  const h = await Holiday.create({ date, name: String(name).trim() });
  await audit(req.user, 'holiday.add', h.name, h.date);
  res.status(201).json(h);
};

const removeHoliday = async (req, res) => {
  const h = await Holiday.findById(req.params.id);
  if (!h) fail(404, 'Holiday not found');
  await h.deleteOne();
  await audit(req.user, 'holiday.delete', h.name, h.date);
  res.json({ message: 'Holiday removed' });
};

// ----- settings -----
const getSettings = async (req, res) => res.json(await Settings.get());

const SETTING_LABELS = {
  companyName: 'company name', timezone: 'timezone', workStart: 'start time', workEnd: 'end time', graceMinutes: 'grace period',
  fullDayHours: 'full day', halfDayHours: 'short day', autoSignOutHours: 'auto sign-out', weekendDays: 'weekend days', leaveAllowance: 'leave allowance',
};

const updateSettings = async (req, res) => {
  const s = await Settings.get();
  const b = req.body;
  const before = JSON.stringify(Object.fromEntries(Object.keys(SETTING_LABELS).map((k) => [k, s[k]])));
  const snap = JSON.parse(before);
  if (b.companyName !== undefined) s.companyName = String(b.companyName).trim() || 'HRPulse';
  if (b.timezone !== undefined) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: b.timezone }); } catch { fail(400, 'Unknown timezone'); }
    s.timezone = b.timezone;
  }
  for (const k of ['workStart', 'workEnd']) {
    if (b[k] !== undefined) { if (!isValidHHMM(b[k])) fail(400, `${k} must be HH:MM`); s[k] = b[k]; }
  }
  for (const k of ['graceMinutes', 'fullDayHours', 'halfDayHours', 'autoSignOutHours']) {
    if (b[k] !== undefined) {
      const n = Number(b[k]);
      if (!Number.isFinite(n) || n < 0) fail(400, `${k} must be a positive number`);
      s[k] = n;
    }
  }
  if (b.weekendDays !== undefined) {
    if (!Array.isArray(b.weekendDays) || b.weekendDays.some((d) => ![0, 1, 2, 3, 4, 5, 6].includes(d))) fail(400, 'Invalid weekend days');
    s.weekendDays = [...new Set(b.weekendDays)].sort();
  }
  if (b.leaveAllowance) {
    for (const t of ['annual', 'sick', 'casual']) {
      if (b.leaveAllowance[t] !== undefined) s.leaveAllowance[t] = Math.max(0, Number(b.leaveAllowance[t]) || 0);
    }
  }
  if (s.halfDayHours > s.fullDayHours) fail(400, 'Half-day hours cannot exceed full-day hours');
  await s.save();
  const changed = Object.keys(SETTING_LABELS).filter((k) => JSON.stringify(snap[k]) !== JSON.stringify(s.toObject()[k]));
  if (changed.length) await audit(req.user, 'settings.update', s.companyName, changed.map((k) => SETTING_LABELS[k]).join(', '));
  res.json(s);
};

// ----- announcements -----
const listAnnouncements = async (req, res) => {
  const s = await Settings.get();
  const today = dateStrIn(s.timezone);
  const all = req.query.all === '1' && req.user.role === 'manager';
  const items = await Announcement.find().sort({ pinned: -1, createdAt: -1 }).limit(50).populate('author', 'name');
  res.json(all ? items : items.filter((a) => !a.expiresOn || a.expiresOn >= today).slice(0, 10));
};

const addAnnouncement = async (req, res) => {
  const { title, body, pinned, expiresOn } = req.body;
  if (!String(title || '').trim()) fail(400, 'Add a title');
  if (expiresOn && !isValidDateStr(expiresOn)) fail(400, 'Expiry must be a date');
  const a = await Announcement.create({ title: String(title).trim(), body: String(body || '').trim(), pinned: !!pinned, expiresOn: expiresOn || '', author: req.user._id });
  await audit(req.user, 'announcement.post', a.title);
  res.status(201).json(a);
};

const removeAnnouncement = async (req, res) => {
  const a = await Announcement.findById(req.params.id);
  if (!a) fail(404, 'Announcement not found');
  await a.deleteOne();
  await audit(req.user, 'announcement.delete', a.title);
  res.json({ message: 'Announcement removed' });
};

// ----- audit log -----
const listAudit = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const filter = req.query.action ? { action: new RegExp(`^${String(req.query.action).replace(/[^a-z.]/g, '')}`) } : {};
  res.json(await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit));
};

module.exports = {
  listHolidays, addHoliday, removeHoliday, getSettings, updateSettings,
  listAnnouncements, addAnnouncement, removeAnnouncement, listAudit,
};

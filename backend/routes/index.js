const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect, authorize } = require('../middleware/auth');
const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const att = require('../controllers/attendanceController');
const leave = require('../controllers/leaveController');
const misc = require('../controllers/miscController');
const dash = require('../controllers/dashboardController');

const router = express.Router();
const manager = [protect, authorize('manager')];

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Try again in 15 minutes.' },
});

// auth & profile
router.post('/auth/login', loginLimiter, auth.login);
router.get('/auth/me', protect, auth.me);
router.put('/auth/me', protect, auth.updateMe);
router.put('/auth/password', protect, auth.changePassword);

// self attendance (all roles)
router.post('/attendance/signin', protect, att.signIn);
router.post('/attendance/signout', protect, att.signOut);
router.get('/attendance/status', protect, att.status);
router.get('/attendance/me', protect, att.myHistory);

// manager attendance tools
router.get('/attendance/records', ...manager, att.records);
router.get('/attendance/export', ...manager, att.exportCsv);
router.post('/attendance/manual', ...manager, att.upsertManual);
router.delete('/attendance/:id', ...manager, att.removeRecord);
router.get('/dashboard', ...manager, dash.managerDashboard);

// users
router.get('/users', ...manager, users.listUsers);
router.get('/users/departments', ...manager, users.departments);
router.get('/users/:id', ...manager, users.getUser);
router.post('/users', ...manager, users.createUser);
router.put('/users/:id', ...manager, users.updateUser);
router.patch('/users/:id/active', ...manager, users.setActive);
router.delete('/users/:id', ...manager, users.deleteUser);

// leave
router.get('/leaves/mine', protect, leave.myLeaves);
router.post('/leaves', protect, leave.requestLeave);
router.patch('/leaves/:id/cancel', protect, leave.cancelLeave);
router.get('/leaves', ...manager, leave.listLeaves);
router.patch('/leaves/:id/review', ...manager, leave.reviewLeave);
router.get('/leaves/balance/:userId', ...manager, leave.userBalance);

// holidays, settings, announcements, audit
router.get('/holidays', protect, misc.listHolidays);
router.post('/holidays', ...manager, misc.addHoliday);
router.delete('/holidays/:id', ...manager, misc.removeHoliday);
router.get('/settings', ...manager, misc.getSettings);
router.put('/settings', ...manager, misc.updateSettings);
router.get('/announcements', protect, misc.listAnnouncements);
router.post('/announcements', ...manager, misc.addAnnouncement);
router.delete('/announcements/:id', ...manager, misc.removeAnnouncement);
router.get('/audit', ...manager, misc.listAudit);

module.exports = router;

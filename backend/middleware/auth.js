const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not signed in' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Account no longer exists' });
    if (!user.isActive) return res.status(403).json({ message: 'Your account has been deactivated. Contact your manager.' });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Session expired. Sign in again.' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have access to this' });
  }
  return next();
};

module.exports = { protect, authorize };

const AuditLog = require('../models/AuditLog');

const audit = async (actor, action, targetName = '', details = '') => {
  try {
    await AuditLog.create({ actor: actor?._id, actorName: actor?.name || 'System', action, targetName, details });
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
};

module.exports = audit;

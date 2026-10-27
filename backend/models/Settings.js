const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    companyName: { type: String, default: 'HRPulse' },
    timezone: { type: String, default: 'Asia/Karachi' },
    workStart: { type: String, default: '09:00' }, // HH:MM
    workEnd: { type: String, default: '18:00' },
    graceMinutes: { type: Number, default: 15, min: 0, max: 240 },
    fullDayHours: { type: Number, default: 8, min: 1, max: 24 },
    halfDayHours: { type: Number, default: 4, min: 0, max: 24 },
    autoSignOutHours: { type: Number, default: 15, min: 1, max: 24 },
    weekendDays: { type: [Number], default: [0, 6] }, // 0 = Sunday
    leaveAllowance: {
      annual: { type: Number, default: 14 },
      sick: { type: Number, default: 8 },
      casual: { type: Number, default: 10 },
    },
  },
  { timestamps: true }
);

settingsSchema.statics.get = async function getSettings() {
  let s = await this.findOne({ key: 'global' });
  if (!s) s = await this.create({ key: 'global' });
  return s;
};

module.exports = mongoose.model('Settings', settingsSchema);

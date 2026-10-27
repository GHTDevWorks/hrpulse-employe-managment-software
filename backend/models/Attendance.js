const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD in company timezone
    signInTime: { type: Date },
    signOutTime: { type: Date },
    lateMinutes: { type: Number, default: 0 },
    signInNote: { type: String, default: '', maxlength: 300 },
    signOutNote: { type: String, default: '', maxlength: 500 },
    managerNote: { type: String, default: '', maxlength: 300 },
    source: { type: String, enum: ['self', 'manual', 'migrated'], default: 'self' },
    autoSignedOut: { type: Boolean, default: false },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    editedAt: { type: Date },
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

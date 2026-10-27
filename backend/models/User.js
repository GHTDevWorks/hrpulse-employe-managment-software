const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['employee', 'developer', 'manager'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'employee' },
    employeeCode: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    joinDate: { type: String, default: '' }, // YYYY-MM-DD; days before this are not counted as absent
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = function matchPassword(entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const o = this.toObject();
  delete o.password;
  delete o.__v;
  delete o.attendance; // legacy v1 field
  return o;
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;

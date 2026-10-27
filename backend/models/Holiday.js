const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Holiday', holidaySchema);

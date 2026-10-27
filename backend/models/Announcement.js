const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, default: '', maxlength: 1000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pinned: { type: Boolean, default: false },
    expiresOn: { type: String, default: '' }, // YYYY-MM-DD, empty = never
  },
  { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);

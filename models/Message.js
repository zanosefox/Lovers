const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['text', 'system', 'gift', 'image'],
    default: 'text'
  },
  // 🎁 For gift messages
  gift: {
    name: String,
    icon: String,
    value: Number
  },
  // ⚠️ Is this a system message? (joined, left, etc.)
  isSystem: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for fast fetching by room
messageSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);

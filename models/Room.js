const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    default: '',
    maxlength: 300
  },
  // 👑 Owner of the room
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 🎤 Admins who can manage the room
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // 🏠 Type of room
  type: {
    type: String,
    enum: ['public', 'private', 'paid'],
    default: 'public'
  },
  // 💰 Entry fee for paid rooms
  entryFee: {
    type: Number,
    default: 0
  },
  // 🏷️ Category/Topic
  category: {
    type: String,
    enum: ['chat', 'music', 'gaming', 'love', 'study', 'arabic', 'english', 'other'],
    default: 'chat'
  },
  // 🌍 Language (named roomLanguage to avoid clashing with MongoDB's
  // reserved "language" field used by text indexes)
  roomLanguage: {
    type: String,
    enum: ['arabic', 'english', 'french', 'spanish', 'turkish', 'german', 'other'],
    default: 'arabic'
  },
  // 🎫 Max users in the room
  maxUsers: {
    type: Number,
    default: 10
  },
  // 🖼️ Room cover image
  coverImage: {
    type: String,
    default: ''
  },
  // 🏠 Background image
  backgroundImage: {
    type: String,
    default: ''
  },
  // 📊 Stats
  currentUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'speaker', 'listener'],
      default: 'listener'
    },
    isMuted: {
      type: Boolean,
      default: true
    },
    isHandRaised: {
      type: Boolean,
      default: false
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // 🔒 Password for private rooms
  password: {
    type: String,
    default: ''
  },
  // 🎵 Background music
  backgroundMusic: {
    type: String,
    default: ''
  },
  // 🔴 Is the room live now?
  isLive: {
    type: Boolean,
    default: true
  },
  // 🔢 Total users who ever joined
  totalVisits: {
    type: Number,
    default: 0
  },
  // 🎁 Gifts received in this room
  giftsCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for fast searching
roomSchema.index({ name: 'text', description: 'text' });
roomSchema.index({ category: 1, isLive: 1 });

module.exports = mongoose.model('Room', roomSchema);

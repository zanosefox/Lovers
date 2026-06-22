const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: '',
    maxlength: 200
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    default: 'male'
  },
  age: {
    type: Number,
    default: 18,
    min: 16,
    max: 100
  },
  country: {
    type: String,
    default: ''
  },
  // 🎮 Gaming/Economy
  coins: {
    type: Number,
    default: 100
  },
  diamonds: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  xp: {
    type: Number,
    default: 0
  },
  // 🏆 Status
  isVIP: {
    type: Boolean,
    default: false
  },
  vipLevel: {
    type: Number,
    default: 0
  },
  // 🎁 Gifts received
  giftsReceived: {
    type: Number,
    default: 0
  },
  // 🏠 Agency
  agency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agency',
    default: null
  },
  // 🎤 Voice status
  isMuted: {
    type: Boolean,
    default: false
  },
  // 📱 Firebase Cloud Messaging token for push notifications
  fcmToken: {
    type: String,
    default: ''
  },
  // 🟢 Online status
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  // 🔁 Password reset (OTP code)
  resetCode: {
    type: String,
    default: null
  },
  resetCodeExpires: {
    type: Date,
    default: null
  },
  // 🚫 Banned by admin
  isBanned: {
    type: Boolean,
    default: false
  },
  bannedAt: {
    type: Date,
    default: null
  },
  bannedReason: {
    type: String,
    default: ''
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // 🛡️ Admin privileges
  isAdmin: {
    type: Boolean,
    default: false,
    index: true
  },
  adminRole: {
    type: String,
    enum: ['admin', 'super_admin'],
    default: 'admin'
  },
  // 🔢 Avatar public_id on Cloudinary (for deletion on replace)
  avatarPublicId: {
    type: String,
    default: ''
  },
  // 🖼️ Cover image (profile banner)
  coverImage: {
    type: String,
    default: ''
  },
  coverPublicId: {
    type: String,
    default: ''
  },
  // 📷 Photo gallery (max 6 photos)
  photos: [{
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    addedAt: { type: Date, default: Date.now }
  }],
  // 🚫 Blocked users
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // 📋 Users I'm following
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // 👥 Followers count (denormalized for speed)
  followersCount: {
    type: Number,
    default: 0
  },
  followingCount: {
    type: Number,
    default: 0
  },
  // 👁️ Profile visits
  profileVisits: {
    type: Number,
    default: 0
  },
  // ⚙️ User settings
  settings: {
    isPrivate: { type: Boolean, default: false },
    showOnline: { type: Boolean, default: true },
    allowMessages: { type: Boolean, default: true },
    allowGifts: { type: Boolean, default: true },
    notifications: {
      likes: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
      followers: { type: Boolean, default: true },
      gifts: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      rooms: { type: Boolean, default: true }
    }
  },
  // 🔗 Social links
  socialLinks: {
    instagram: { type: String, default: '' },
    tiktok: { type: String, default: '' },
    snapchat: { type: String, default: '' },
    twitter: { type: String, default: '' }
  }
}, {
  timestamps: true
});

// Index for fast follow/unfollow lookups
userSchema.index({ following: 1 });
userSchema.index({ blockedUsers: 1 });

module.exports = mongoose.model('User', userSchema);

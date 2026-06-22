const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  // 👤 Author of the post
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // 📝 Text content
  text: {
    type: String,
    default: '',
    maxlength: 2000
  },
  // 🖼️ Media attached (photos/videos)
  media: [{
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    type: {
      type: String,
      enum: ['image', 'video'],
      default: 'image'
    }
  }],
  // ❤️ Likes
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // 🔢 Denormalized counts for fast reads
  likesCount: {
    type: Number,
    default: 0
  },
  commentsCount: {
    type: Number,
    default: 0
  },
  sharesCount: {
    type: Number,
    default: 0
  },
  // 🏷️ Hashtags extracted from text (e.g. #love)
  hashtags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  // 📍 Optional location
  location: {
    type: String,
    default: '',
    maxlength: 100
  },
  // 🎭 Post visibility
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'public'
  },
  // 🚩 Reports (for moderation)
  reports: [{
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reportsCount: {
    type: Number,
    default: 0
  },
  // 🚫 Hidden by admin
  isHidden: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ hashtags: 1 });

module.exports = mongoose.model('Post', postSchema);

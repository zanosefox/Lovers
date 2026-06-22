const mongoose = require('mongoose');

const agencySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  // 👑 Owner of the agency
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    default: '',
    maxlength: 500
  },
  logo: {
    type: String,
    default: ''
  },
  // 👥 Members of the agency
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // 📊 Agency stats
  level: {
    type: Number,
    default: 1
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  // 🎯 Agency requirements
  minLevel: {
    type: Number,
    default: 1
  },
  // 🏠 Recruiters can invite users
  recruiters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Agency', agencySchema);

const mongoose = require('mongoose');

const giftSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  // 🎨 Emoji or icon
  icon: {
    type: String,
    required: true
  },
  // 🖼️ Image URL (Cloudinary)
  image: {
    type: String,
    default: ''
  },
  // 💰 Value in coins
  coinValue: {
    type: Number,
    required: true
  },
  // 💎 Value in diamonds (for VIP gifts)
  diamondValue: {
    type: Number,
    default: 0
  },
  // 📊 Rarity
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  // 🎭 Category
  category: {
    type: String,
    enum: ['love', 'fun', 'music', 'vip', 'special'],
    default: 'fun'
  },
  // ✅ Active status (admin can deactivate without deleting)
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Gift', giftSchema);

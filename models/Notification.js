const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // 👤 Recipient of the notification
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // 👤 Who triggered the notification
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // 📝 Notification type
  type: {
    type: String,
    enum: [
      'like',           // ❤️ Someone liked your post
      'comment',        // 💬 Someone commented on your post
      'follow',         // 👥 Someone followed you
      'gift',           // 🎁 Someone sent you a gift
      'mention',        // @ Someone mentioned you in a comment/post
      'room_invite',    // 🏠 Someone invited you to a room
      'room_activity',  // 🎤 Something happened in your room
      'system',         // ⚙️ System notification (admin)
      'level_up',       // 🆙 You leveled up
      'achievement'     // 🏆 Achievement unlocked
    ],
    required: true
  },
  // 📄 Notification text / title
  title: {
    type: String,
    required: true
  },
  // 💬 Notification body / message
  body: {
    type: String,
    default: ''
  },
  // 🔗 Reference data (e.g. postId, roomId, commentId)
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  referenceType: {
    type: String,
    enum: ['post', 'comment', 'room', 'gift', 'user', 'agency', null],
    default: null
  },
  // 📎 Extra data (JSON flexible)
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // 📖 Read status
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  // 🗑️ Deleted by user (soft delete)
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

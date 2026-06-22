const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // 👤 The admin who performed the action
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // 📋 Type of action performed
  action: {
    type: String,
    enum: [
      'ban_user',
      'unban_user',
      'grant_vip',
      'revoke_vip',
      'adjust_balance',
      'hide_post',
      'unhide_post',
      'delete_post',
      'hide_comment',
      'create_gift',
      'update_gift',
      'delete_gift',
      'toggle_gift',
      'verify_agency',
      'broadcast_notification',
      'other'
    ],
    required: true
  },
  // 🎯 The entity affected (user, post, comment, gift, agency)
  targetType: {
    type: String,
    enum: ['user', 'post', 'comment', 'gift', 'agency', 'system'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  // 📝 Human-readable summary
  summary: {
    type: String,
    default: ''
  },
  // 📎 Extra context (before/after values, reason, amount, etc.)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // 🌐 Request info
  ip: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes
auditLogSchema.index({ admin: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

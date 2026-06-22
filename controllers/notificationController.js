const Notification = require('../models/Notification');

// Helper: format notification with sender info
const formatNotification = (n) => ({
  id: n._id,
  type: n.type,
  title: n.title,
  body: n.body,
  sender: n.sender ? {
    id: n.sender._id || n.sender,
    username: n.sender.username || '',
    avatar: n.sender.avatar || ''
  } : null,
  referenceId: n.referenceId,
  referenceType: n.referenceType,
  data: n.data || {},
  isRead: n.isRead,
  createdAt: n.createdAt
});

// ============================================
// 🔔 CORE HELPER: Create Notification
// ============================================

/**
 * Create a notification and optionally push via FCM + Socket.IO
 * This is the central helper used by other controllers.
 */
exports.createNotification = async ({
  recipient,
  sender,
  type,
  title,
  body = '',
  referenceId = null,
  referenceType = null,
  data = {},
  pushFCM = true
}) => {
  try {
    // Don't notify yourself
    if (sender && recipient.toString() === sender.toString()) return null;

    const notification = await Notification.create({
      recipient,
      sender,
      type,
      title,
      body,
      referenceId,
      referenceType,
      data
    });

    // Populate sender info
    await notification.populate('sender', 'username avatar level isVIP gender');

    // ---- FCM Push Notification ----
    if (pushFCM) {
      try {
        const User = require('../models/User');
        const recipientUser = await User.findById(recipient).select('fcmToken settings');
        if (recipientUser && recipientUser.fcmToken) {
          // Check notification preferences
          const settings = recipientUser.settings || {};
          const prefs = settings.notifications || {};

          let shouldSend = true;
          if (type === 'like' && prefs.likes === false) shouldSend = false;
          if (type === 'comment' && prefs.comments === false) shouldSend = false;
          if (type === 'follow' && prefs.follows === false) shouldSend = false;
          if (type === 'gift' && prefs.gifts === false) shouldSend = false;
          if (type === 'system') shouldSend = true; // Always send system

          if (shouldSend) {
            const { sendNotification } = require('../config/firebase');
            await sendNotification(recipientUser.fcmToken, {
              title,
              body: body || title,
              data: {
                type,
                notificationId: notification._id.toString(),
                ...(referenceId ? { referenceId: referenceId.toString() } : {}),
                ...(referenceType ? { referenceType } : {})
              }
            });
          }
        }
      } catch (fcmErr) {
        // Don't fail the notification creation if FCM fails
        console.error('FCM push error:', fcmErr.message);
      }
    }

    // ---- Socket.IO Real-time Emit ----
    try {
      const { getIo } = require('../config/socketStore');
      const io = getIo();
      // io is available, emit to user's personal room
      if (io) {
        io.to(`user:${recipient.toString()}`).emit('notification:new', {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          sender: notification.sender ? {
            id: notification.sender._id.toString(),
            username: notification.sender.username,
            avatar: notification.sender.avatar
          } : null,
          referenceId: notification.referenceId,
          referenceType: notification.referenceType,
          data: notification.data,
          isRead: false,
          createdAt: notification.createdAt
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error:', socketErr.message);
    }

    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

// ============================================
// 📖 GET NOTIFICATIONS (with filters)
// ============================================

/**
 * @desc    Get user's notifications (paginated, filterable)
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const type = req.query.type;         // filter by type
    const unreadOnly = req.query.unread === 'true';

    const query = {
      recipient: req.userId,
      isDeleted: false
    };

    if (type) {
      query.type = type;
    }
    if (unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .populate('sender', 'username avatar level isVIP gender')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      recipient: req.userId,
      isRead: false,
      isDeleted: false
    });

    res.json({
      notifications: notifications.map(formatNotification),
      page,
      totalPages: Math.ceil(total / limit),
      total,
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 🔢 UNREAD COUNT
// ============================================

/**
 * @desc    Get unread notifications count
 * @route   GET /api/notifications/unread
 * @access  Private
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.userId,
      isRead: false,
      isDeleted: false
    });

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// ✅ MARK AS READ (single)
// ============================================

/**
 * @desc    Mark a notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: '❌ Notification not found' });
    }

    if (notification.recipient.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: '❌ Not authorized' });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ message: '✅ Marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// ✅✅ MARK ALL AS READ
// ============================================

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const type = req.body.type; // optionally filter by type

    const query = {
      recipient: req.userId,
      isRead: false,
      isDeleted: false
    };
    if (type) {
      query.type = type;
    }

    const result = await Notification.updateMany(query, { isRead: true });

    res.json({
      message: '✅ All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 🗑️ DELETE NOTIFICATION
// ============================================

/**
 * @desc    Delete (soft) a notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: '❌ Notification not found' });
    }

    if (notification.recipient.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: '❌ Not authorized' });
    }

    notification.isDeleted = true;
    await notification.save();

    res.json({ message: '✅ Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 🗑️🗑️ CLEAR ALL NOTIFICATIONS
// ============================================

/**
 * @desc    Clear all notifications for user
 * @route   DELETE /api/notifications
 * @access  Private
 */
exports.clearAllNotifications = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.userId, isDeleted: false },
      { isDeleted: true }
    );

    res.json({
      message: '✅ All notifications cleared',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Clear all error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// ⚙️ ADMIN: Send system notification
// ============================================

/**
 * @desc    Admin sends a system notification to all or specific user
 * @route   POST /api/notifications/admin/send
 * @access  Private (admin only)
 */
exports.sendSystemNotification = async (req, res) => {
  try {
    const { recipientId, title, body, data } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: '❌ Title is required' });
    }

    if (recipientId) {
      // Send to specific user
      await exports.createNotification({
        recipient: recipientId,
        sender: req.userId,
        type: 'system',
        title: title.trim(),
        body: body || '',
        data: data || {},
        pushFCM: true
      });
    } else {
      // Send to all users
      const User = require('../models/User');
      const users = await User.find({}, '_id').lean();
      let sent = 0;
      for (const u of users) {
        const n = await exports.createNotification({
          recipient: u._id,
          sender: req.userId,
          type: 'system',
          title: title.trim(),
          body: body || '',
          data: data || {},
          pushFCM: true
        });
        if (n) sent++;
      }
      return res.json({ message: `✅ Sent to ${sent} users` });
    }

    res.json({ message: '✅ System notification sent' });
  } catch (error) {
    console.error('Send system notification error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// ============================================
// 📖 GET
// ============================================

// @route   GET /api/notifications
// @desc    Get all notifications (paginated, filterable)
// @access  Private
router.get('/', auth, notificationController.getNotifications);

// @route   GET /api/notifications/unread
// @desc    Get unread notifications count
// @access  Private
router.get('/unread', auth, notificationController.getUnreadCount);

// ============================================
// ✅ MARK AS READ
// ============================================

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', auth, notificationController.markAllAsRead);

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
router.put('/:id/read', auth, notificationController.markAsRead);

// ============================================
// 🗑️ DELETE
// ============================================

// @route   DELETE /api/notifications
// @desc    Clear all notifications (soft delete)
// @access  Private
router.delete('/', auth, notificationController.clearAllNotifications);

// @route   DELETE /api/notifications/:id
// @desc    Delete a single notification (soft delete)
// @access  Private
router.delete('/:id', auth, notificationController.deleteNotification);

// ============================================
// ⚙️ ADMIN
// ============================================

// @route   POST /api/notifications/admin/send
// @desc    Admin: send system notification
// @access  Private (admin)
router.post('/admin/send', auth, adminAuth('admin'), notificationController.sendSystemNotification);

module.exports = router;

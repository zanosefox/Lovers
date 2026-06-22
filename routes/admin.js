const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// ============================================
// 📊 DASHBOARD
// ============================================

// @route   GET /api/admin/dashboard
// @desc    Admin dashboard stats
// @access  Private (admin)
router.get('/dashboard', auth, adminAuth('admin'), adminController.getDashboard);

// ============================================
// 👥 USER MANAGEMENT
// ============================================

// @route   GET /api/admin/users
// @desc    Get all users (paginated, searchable)
// @access  Private (admin)
router.get('/users', auth, adminAuth('admin'), adminController.getUsers);

// @route   GET /api/admin/users/:id
// @desc    Get single user details (admin view)
// @access  Private (admin)
router.get('/users/:id', auth, adminAuth('admin'), adminController.getUserDetails);

// @route   POST /api/admin/users/:id/ban
// @desc    Ban a user
// @access  Private (admin)
router.post('/users/:id/ban', auth, adminAuth('admin'), adminController.banUser);

// @route   POST /api/admin/users/:id/unban
// @desc    Unban a user
// @access  Private (admin)
router.post('/users/:id/unban', auth, adminAuth('admin'), adminController.unbanUser);

// ============================================
// 🏆 VIP MANAGEMENT (super_admin only)
// ============================================

// @route   POST /api/admin/users/:id/grant-vip
// @desc    Grant VIP to a user
// @access  Private (super_admin)
router.post('/users/:id/grant-vip', auth, adminAuth('super_admin'), adminController.grantVIP);

// @route   POST /api/admin/users/:id/revoke-vip
// @desc    Revoke VIP from a user
// @access  Private (super_admin)
router.post('/users/:id/revoke-vip', auth, adminAuth('super_admin'), adminController.revokeVIP);

// ============================================
// 💰 BALANCE ADJUSTMENT (super_admin only)
// ============================================

// @route   POST /api/admin/users/:id/adjust-balance
// @desc    Adjust user balance (coins/diamonds)
// @access  Private (super_admin)
router.post('/users/:id/adjust-balance', auth, adminAuth('super_admin'), adminController.adjustBalance);

// ============================================
// 📝 POST MODERATION
// ============================================

// @route   GET /api/admin/posts/reported
// @desc    Get reported posts
// @access  Private (admin)
router.get('/posts/reported', auth, adminAuth('admin'), adminController.getReportedPosts);

// @route   POST /api/admin/posts/:id/hide
// @desc    Hide a post (soft moderation)
// @access  Private (admin)
router.post('/posts/:id/hide', auth, adminAuth('admin'), adminController.hidePost);

// @route   POST /api/admin/posts/:id/unhide
// @desc    Unhide a post
// @access  Private (admin)
router.post('/posts/:id/unhide', auth, adminAuth('admin'), adminController.unhidePost);

// @route   DELETE /api/admin/posts/:id
// @desc    Delete a post (admin override)
// @access  Private (admin)
router.delete('/posts/:id', auth, adminAuth('admin'), adminController.deletePost);

// ============================================
// 💬 COMMENT MODERATION
// ============================================

// @route   GET /api/admin/comments/reported
// @desc    Get reported comments
// @access  Private (admin)
router.get('/comments/reported', auth, adminAuth('admin'), adminController.getReportedComments);

// @route   POST /api/admin/comments/:id/hide
// @desc    Hide a comment
// @access  Private (admin)
router.post('/comments/:id/hide', auth, adminAuth('admin'), adminController.hideComment);

// ============================================
// 🎁 GIFT MANAGEMENT
// ============================================

// @route   POST /api/admin/gifts
// @desc    Create a new gift
// @access  Private (admin)
router.post('/gifts', auth, adminAuth('admin'), adminController.createGift);

// @route   PUT /api/admin/gifts/:id
// @desc    Update a gift
// @access  Private (admin)
router.put('/gifts/:id', auth, adminAuth('admin'), adminController.updateGift);

// @route   DELETE /api/admin/gifts/:id
// @desc    Delete a gift
// @access  Private (super_admin)
router.delete('/gifts/:id', auth, adminAuth('super_admin'), adminController.deleteGift);

// @route   POST /api/admin/gifts/:id/toggle
// @desc    Toggle gift active status
// @access  Private (admin)
router.post('/gifts/:id/toggle', auth, adminAuth('admin'), adminController.toggleGift);

// ============================================
// 🏛️ AGENCY MANAGEMENT (super_admin only)
// ============================================

// @route   GET /api/admin/agencies
// @desc    Get all agencies (admin view)
// @access  Private (admin)
router.get('/agencies', auth, adminAuth('admin'), adminController.getAgencies);

// @route   POST /api/admin/agencies/:id/verify
// @desc    Verify an agency
// @access  Private (super_admin)
router.post('/agencies/:id/verify', auth, adminAuth('super_admin'), adminController.verifyAgency);

// ============================================
// 📋 AUDIT LOGS
// ============================================

// @route   GET /api/admin/audit-logs
// @desc    Get audit logs (paginated, filterable)
// @access  Private (admin)
router.get('/audit-logs', auth, adminAuth('admin'), adminController.getAuditLogs);

module.exports = router;

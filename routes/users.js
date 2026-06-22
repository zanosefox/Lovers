const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const { handleUploadErrors, uploadAvatar, uploadCover, uploadImages } = require('../middleware/upload');

// ============================================
// 📌 ME & PROFILE
// ============================================

// @route   GET /api/users/me
router.get('/me', auth, userController.getMyProfile);

// @route   PUT /api/users/profile
router.put('/profile', auth, userController.updateProfile);

// @route   GET /api/users/profile-stats
router.get('/profile-stats', auth, userController.getProfileStats);

// ============================================
// 🖼️ IMAGES
// ============================================

// @route   POST /api/users/avatar
router.post('/avatar', auth, handleUploadErrors(uploadAvatar), userController.uploadAvatar);

// @route   POST /api/users/cover
router.post('/cover', auth, handleUploadErrors(uploadCover), userController.uploadCover);

// @route   POST /api/users/photos
router.post('/photos', auth, handleUploadErrors(uploadImages), userController.addPhoto);

// @route   DELETE /api/users/photos/:photoId
router.delete('/photos/:photoId', auth, userController.removePhoto);

// ============================================
// ⚙️ SETTINGS & SOCIAL
// ============================================

// @route   PUT /api/users/settings
router.put('/settings', auth, userController.updateSettings);

// @route   PUT /api/users/social-links
router.put('/social-links', auth, userController.updateSocialLinks);

// ============================================
// 🚫 BLOCK / UNBLOCK
// ============================================

// @route   POST /api/users/block/:userId
router.post('/block/:userId', auth, userController.blockUser);

// @route   DELETE /api/users/block/:userId
router.delete('/block/:userId', auth, userController.unblockUser);

// @route   GET /api/users/blocked
router.get('/blocked', auth, userController.getBlockedUsers);

// ============================================
// 👥 FOLLOW / UNFOLLOW
// ============================================

// @route   POST /api/users/follow/:userId
router.post('/follow/:userId', auth, userController.followUser);

// @route   DELETE /api/users/follow/:userId
router.delete('/follow/:userId', auth, userController.unfollowUser);

// @route   GET /api/users/following
router.get('/following', auth, userController.getFollowing);

// ============================================
// 🌐 PUBLIC
// ============================================

// @route   GET /api/users/leaderboard
router.get('/leaderboard', userController.getLeaderboard);

// @route   GET /api/users/check-username/:username
router.get('/check-username/:username', userController.checkUsername);

// @route   GET /api/users/search/:query
router.get('/search/:query', userController.searchUsers);

// @route   GET /api/users/:id
router.get('/:id', userController.getUserProfile);

// @route   GET /api/users/:id/messages
router.get('/:id/messages', userController.getUserMessages);

module.exports = router;

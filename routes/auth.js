const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// @route   POST /api/auth/register
router.post('/register', authController.register);

// @route   POST /api/auth/login
router.post('/login', authController.login);

// @route   POST /api/auth/logout
router.post('/logout', auth, authController.logout);

// @route   GET /api/auth/me
router.get('/me', auth, authController.getMe);

// @route   PUT /api/auth/change-password
router.put('/change-password', auth, authController.changePassword);

// @route   DELETE /api/auth/account
router.delete('/account', auth, authController.deleteAccount);

// @route   PUT /api/auth/fcm-token
router.put('/fcm-token', auth, authController.updateFcmToken);

// @route   POST /api/auth/forgot-password
router.post('/forgot-password', authController.forgotPassword);

// @route   POST /api/auth/reset-password
router.post('/reset-password', authController.resetPassword);

module.exports = router;

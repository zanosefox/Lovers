const express = require('express');
const router = express.Router();
const giftController = require('../controllers/giftController');
const { auth } = require('../middleware/auth');

// @route   GET /api/gifts/categories
router.get('/categories', giftController.getGiftCategories);

// @route   GET /api/gifts
router.get('/', giftController.getAllGifts);

// @route   POST /api/gifts/send
router.post('/send', auth, giftController.sendGift);

module.exports = router;

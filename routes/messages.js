const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { auth } = require('../middleware/auth');

// @desc    Get messages for a room
// @route   GET /api/messages/:roomId
// @access  Public
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const messages = await Message.find({ room: roomId })
      .populate('sender', 'username avatar level isVIP')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
});

// @desc    Send a message (HTTP fallback - main messaging via Socket.io)
// @route   POST /api/messages
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { roomId, text } = req.body;

    if (!roomId || !text) {
      return res.status(400).json({ message: '❌ roomId and text are required' });
    }

    const message = await Message.create({
      room: roomId,
      sender: req.userId,
      text,
      type: 'text'
    });

    await message.populate('sender', 'username avatar level isVIP');

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
});

module.exports = router;

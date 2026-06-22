const Gift = require('../models/Gift');
const { createNotification } = require('./notificationController');

// @desc    Get all available gifts
// @route   GET /api/gifts
// @access  Public
exports.getAllGifts = async (req, res) => {
  try {
    const { category, rarity } = req.query;
    const query = {};

    if (category) query.category = category;
    if (rarity) query.rarity = rarity;

    const gifts = await Gift.find(query).sort({ coinValue: 1 });

    res.json({ gifts });
  } catch (error) {
    console.error('Get gifts error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get gift categories
// @route   GET /api/gifts/categories
// @access  Public
exports.getGiftCategories = async (req, res) => {
  try {
    // Using aggregation to get unique categories with counts
    const categories = await Gift.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Send a gift (from user to user in room)
// @route   POST /api/gifts/send
// @access  Private
exports.sendGift = async (req, res) => {
  try {
    const { giftId, receiverId, roomId } = req.body;

    if (!giftId || !receiverId) {
      return res.status(400).json({ message: '❌ Gift ID and receiver ID are required' });
    }

    // Find the gift
    const gift = await Gift.findById(giftId);
    if (!gift) {
      return res.status(404).json({ message: '❌ Gift not found' });
    }

    // Find sender (with coins)
    const User = require('../models/User');
    const sender = await User.findById(req.userId);
    if (!sender) {
      return res.status(404).json({ message: '❌ Sender not found' });
    }

    // Check if sender has enough coins
    if (sender.coins < gift.coinValue) {
      return res.status(400).json({
        message: `❌ Not enough coins (need ${gift.coinValue}, have ${sender.coins})`
      });
    }

    // Check receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: '❌ Receiver not found' });
    }

    // Don't send to yourself
    if (req.userId.toString() === receiverId.toString()) {
      return res.status(400).json({ message: '❌ Cannot send gift to yourself' });
    }

    // Deduct coins from sender
    sender.coins -= gift.coinValue;

    // Add diamonds to receiver (10% conversion)
    const diamondReward = Math.floor(gift.coinValue * 0.1);
    receiver.diamonds += diamondReward;
    receiver.giftsReceived += 1;

    // Add XP
    receiver.xp += Math.floor(gift.coinValue / 2);
    sender.xp += Math.floor(gift.coinValue / 5);

    // Level up check
    const xpForNextLevel = (receiver.level * 100);
    let leveledUp = false;
    if (receiver.xp >= xpForNextLevel) {
      receiver.level += 1;
      receiver.xp -= xpForNextLevel;
      leveledUp = true;
    }

    await sender.save();
    await receiver.save();

    // Send level_up notification
    if (leveledUp) {
      await createNotification({
        recipient: receiverId,
        sender: null,
        type: 'level_up',
        title: `🆙 Level Up!`,
        body: `Congratulations! You reached Level ${receiver.level}!`,
        data: { newLevel: receiver.level }
      });
    }

    // Create gift message in room if roomId provided
    if (roomId) {
      const Message = require('../models/Message');
      await Message.create({
        room: roomId,
        sender: req.userId,
        type: 'gift',
        text: `${sender.username} sent ${gift.icon} ${gift.name} to ${receiver.username}`,
        gift: {
          name: gift.name,
          icon: gift.icon,
          value: gift.coinValue
        }
      });
    }

    // Send notification to receiver (save to DB + push + socket)
    await createNotification({
      recipient: receiverId,
      sender: req.userId,
      type: 'gift',
      title: '🎁 New Gift!',
      body: `${sender.username} sent you ${gift.icon} ${gift.name}!`,
      referenceId: gift._id,
      referenceType: 'gift',
      data: {
        giftId: gift._id.toString(),
        senderId: req.userId.toString(),
        roomId: roomId || ''
      }
    });

    res.json({
      message: `✅ Sent ${gift.icon} ${gift.name} to ${receiver.username}`,
      gift: {
        name: gift.name,
        icon: gift.icon,
        coinValue: gift.coinValue,
        diamondReward
      },
      sender: { coins: sender.coins, xp: sender.xp },
      receiver: {
        username: receiver.username,
        diamonds: receiver.diamonds,
        xp: receiver.xp,
        level: receiver.level,
        giftsReceived: receiver.giftsReceived
      }
    });
  } catch (error) {
    console.error('Send gift error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

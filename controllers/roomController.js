const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

// @desc    Create a new room
// @route   POST /api/rooms
// @access  Private
exports.createRoom = async (req, res) => {
  try {
    const { name, description, type, category, language, maxUsers, password, coverImage } = req.body;

    if (!name) {
      return res.status(400).json({ message: '❌ Room name is required' });
    }

    const room = await Room.create({
      name,
      description,
      owner: req.userId,
      admins: [req.userId],
      type: type || 'public',
      category: category || 'chat',
      roomLanguage: language || 'arabic',
      maxUsers: maxUsers || 10,
      password: password || '',
      coverImage: coverImage || ''
    });

    res.status(201).json({
      message: '✅ Room created successfully',
      room
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get all live rooms
// @route   GET /api/rooms
// @access  Public
exports.getRooms = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const query = { isLive: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const rooms = await Room.find(query)
      .populate('owner', 'username avatar level isVIP')
      .sort({ currentUsers: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Room.countDocuments(query);

    res.json({
      rooms,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get room by ID
// @route   GET /api/rooms/:id
// @access  Public
exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('owner', 'username avatar level isVIP')
      .populate('currentUsers.user', 'username avatar gender level isVIP')
      .populate('admins', 'username avatar');

    if (!room) {
      return res.status(404).json({ message: '❌ Room not found' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Join a room
// @route   POST /api/rooms/:id/join
// @access  Private
exports.joinRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: '❌ Room not found' });
    }

    // Check if already in room
    const existingUser = room.currentUsers.find(
      u => u.user.toString() === req.userId.toString()
    );

    if (existingUser) {
      return res.json({ message: '✅ Already in room', room });
    }

    // Check room capacity
    if (room.currentUsers.length >= room.maxUsers) {
      return res.status(400).json({ message: '❌ Room is full' });
    }

    // Check password for private rooms
    if (room.type === 'private' && room.password && room.password !== req.body.password) {
      return res.status(403).json({ message: '❌ Wrong room password' });
    }

    // Check entry fee for paid rooms
    if (room.type === 'paid' && room.entryFee > 0) {
      const user = await User.findById(req.userId);
      if (user.coins < room.entryFee) {
        return res.status(400).json({ message: '❌ Not enough coins' });
      }
      user.coins -= room.entryFee;
      await user.save();
    }

    // Add user to room
    room.currentUsers.push({
      user: req.userId,
      role: 'listener',
      isMuted: true,
      joinedAt: new Date()
    });
    room.totalVisits += 1;
    await room.save();

    // Notify room owner if a VIP joined (room_activity)
    if (req.user.isVIP && room.owner.toString() !== req.userId.toString()) {
      await createNotification({
        recipient: room.owner,
        sender: req.userId,
        type: 'room_activity',
        title: '🎤 VIP joined your room',
        body: `${req.user.username} (VIP) joined "${room.name}"`,
        referenceId: room._id,
        referenceType: 'room',
        data: { roomId: room._id.toString() }
      });
    }

    res.json({ message: '✅ Joined room', room });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Leave a room
// @route   POST /api/rooms/:id/leave
// @access  Private
exports.leaveRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: '❌ Room not found' });
    }

    room.currentUsers = room.currentUsers.filter(
      u => u.user.toString() !== req.userId.toString()
    );

    // If no users left and it's not owner's permanent room, mark as not live
    if (room.currentUsers.length === 0 && room.owner.toString() !== req.userId.toString()) {
      // keep room but not live
    }

    await room.save();

    res.json({ message: '✅ Left room' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Update a room
// @desc    Update a room
// @route   PUT /api/rooms/:id
// @access  Private (Owner/Admin only)
exports.updateRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: '❌ Room not found' });
    }

    // Check ownership or admin
    const isOwner = room.owner.toString() === req.userId.toString();
    const isAdmin = room.admins.some(a => a.toString() === req.userId.toString());
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: '❌ Not authorized' });
    }

    const { name, description, type, category, language, maxUsers, password, coverImage, backgroundImage } = req.body;

    if (name) room.name = name;
    if (description !== undefined) room.description = description;
    if (type) room.type = type;
    if (category) room.category = category;
    if (language) room.roomLanguage = language;
    if (maxUsers) room.maxUsers = maxUsers;
    if (password !== undefined) room.password = password;
    if (coverImage !== undefined) room.coverImage = coverImage;
    if (backgroundImage !== undefined) room.backgroundImage = backgroundImage;

    await room.save();

    res.json({ message: '✅ Room updated', room });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Delete a room
// @route   DELETE /api/rooms/:id
// @access  Private (Owner only)
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: '❌ Room not found' });
    }

    if (room.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: '❌ Only owner can delete room' });
    }

    await Room.findByIdAndDelete(req.params.id);
    await Message.deleteMany({ room: req.params.id });

    res.json({ message: '✅ Room deleted' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get user's rooms
// @route   GET /api/rooms/my/rooms
// @access  Private
exports.getMyRooms = async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [
        { owner: req.userId },
        { admins: req.userId }
      ]
    }).populate('owner', 'username avatar');

    res.json({ rooms });
  } catch (error) {
    console.error('Get my rooms error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Invite a user to a room
// @route   POST /api/rooms/:id/invite
// @access  Private
exports.inviteToRoom = async (req, res) => {
  try {
    const { userId: inviteeId } = req.body;
    if (!inviteeId) {
      return res.status(400).json({ message: '❌ User ID to invite is required' });
    }

    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: '❌ Room not found' });
    }

    // Only owner/admin can invite
    const isOwner = room.owner.toString() === req.userId.toString();
    const isAdmin = room.admins.some(a => a.toString() === req.userId.toString());
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: '❌ Only owner/admin can invite' });
    }

    // Don't invite yourself
    if (inviteeId.toString() === req.userId.toString()) {
      return res.status(400).json({ message: '❌ Cannot invite yourself' });
    }

    // Check invitee exists
    const invitee = await User.findById(inviteeId);
    if (!invitee) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    // Send room_invite notification
    await createNotification({
      recipient: inviteeId,
      sender: req.userId,
      type: 'room_invite',
      title: '🏠 Room Invitation',
      body: `${req.user.username} invited you to join "${room.name}"`,
      referenceId: room._id,
      referenceType: 'room',
      data: { roomId: room._id.toString(), roomName: room.name }
    });

    res.json({ message: `✅ Invitation sent to ${invitee.username}` });
  } catch (error) {
    console.error('Invite to room error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

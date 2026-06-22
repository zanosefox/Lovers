const Agency = require('../models/Agency');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

// @desc    Create a new agency
// @route   POST /api/agencies
// @access  Private
exports.createAgency = async (req, res) => {
  try {
    const { name, description, logo } = req.body;

    if (!name) {
      return res.status(400).json({ message: '❌ Agency name is required' });
    }

    // Check if user already in an agency
    if (req.user.agency) {
      return res.status(400).json({ message: '❌ You are already in an agency. Leave your current agency first.' });
    }

    // Check name uniqueness
    const existing = await Agency.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: '❌ Agency name already taken' });
    }

    const agency = await Agency.create({
      name,
      description: description || '',
      logo: logo || '',
      owner: req.userId,
      members: [{
        user: req.userId,
        role: 'owner',
        joinedAt: new Date()
      }],
      recruiters: [req.userId]
    });

    // Update user's agency
    req.user.agency = agency._id;
    await req.user.save();

    res.status(201).json({
      message: '✅ Agency created successfully',
      agency
    });
  } catch (error) {
    console.error('Create agency error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get agency by ID
// @route   GET /api/agencies/:id
// @access  Public
exports.getAgency = async (req, res) => {
  try {
    const agency = await Agency.findById(req.params.id)
      .populate('owner', 'username avatar level isVIP')
      .populate('members.user', 'username avatar level isVIP')
      .populate('recruiters', 'username avatar');

    if (!agency) {
      return res.status(404).json({ message: '❌ Agency not found' });
    }

    res.json({ agency });
  } catch (error) {
    console.error('Get agency error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get all agencies (paginated)
// @route   GET /api/agencies
// @access  Public
exports.getAllAgencies = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const agencies = await Agency.find(query)
      .populate('owner', 'username avatar')
      .sort({ totalEarnings: -1, level: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Agency.countDocuments(query);

    res.json({
      agencies,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get agencies error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Join an agency
// @route   POST /api/agencies/:id/join
// @access  Private
exports.joinAgency = async (req, res) => {
  try {
    if (req.user.agency) {
      return res.status(400).json({ message: '❌ You are already in an agency' });
    }

    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ message: '❌ Agency not found' });
    }

    // Check if user meets level requirement
    if (req.user.level < agency.minLevel) {
      return res.status(400).json({
        message: `❌ You need level ${agency.minLevel} to join this agency`
      });
    }

    agency.members.push({
      user: req.userId,
      role: 'member',
      joinedAt: new Date()
    });
    await agency.save();

    req.user.agency = agency._id;
    await req.user.save();

    // Notify agency owner of new member
    await createNotification({
      recipient: agency.owner,
      sender: req.userId,
      type: 'system',
      title: '🏛️ New Agency Member',
      body: `${req.user.username} joined your agency "${agency.name}"`,
      referenceId: agency._id,
      referenceType: 'agency',
      data: { agencyName: agency.name }
    });

    res.json({ message: '✅ Joined agency successfully' });
  } catch (error) {
    console.error('Join agency error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Leave an agency
// @route   POST /api/agencies/leave
// @access  Private
exports.leaveAgency = async (req, res) => {
  try {
    if (!req.user.agency) {
      return res.status(400).json({ message: '❌ You are not in an agency' });
    }

    const agency = await Agency.findById(req.user.agency);
    if (!agency) {
      return res.status(404).json({ message: '❌ Agency not found' });
    }

    // Owner can't leave (must transfer or delete)
    if (agency.owner.toString() === req.userId.toString()) {
      return res.status(400).json({ message: '❌ Owner cannot leave. Transfer ownership or delete the agency.' });
    }

    agency.members = agency.members.filter(
      m => m.user.toString() !== req.userId.toString()
    );
    agency.recruiters = agency.recruiters.filter(
      r => r.toString() !== req.userId.toString()
    );
    await agency.save();

    req.user.agency = null;
    await req.user.save();

    // Notify agency owner that a member left
    await createNotification({
      recipient: agency.owner,
      sender: req.userId,
      type: 'system',
      title: '🏛️ Member Left',
      body: `${req.user.username} left your agency "${agency.name}"`,
      referenceId: agency._id,
      referenceType: 'agency',
      data: { agencyName: agency.name }
    });

    res.json({ message: '✅ Left agency successfully' });
  } catch (error) {
    console.error('Leave agency error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Delete an agency (owner only)
// @route   DELETE /api/agencies/:id
// @access  Private
exports.deleteAgency = async (req, res) => {
  try {
    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ message: '❌ Agency not found' });
    }

    if (agency.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: '❌ Only the owner can delete the agency' });
    }

    // Remove agency from all members
    await User.updateMany(
      { agency: agency._id },
      { $unset: { agency: 1 } }
    );

    await Agency.findByIdAndDelete(req.params.id);

    res.json({ message: '✅ Agency deleted successfully' });
  } catch (error) {
    console.error('Delete agency error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Update agency settings
// @route   PUT /api/agencies/:id
// @access  Private (Owner/Admin)
exports.updateAgency = async (req, res) => {
  try {
    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ message: '❌ Agency not found' });
    }

    const isOwner = agency.owner.toString() === req.userId.toString();
    const isAdmin = agency.members.some(
      m => m.user.toString() === req.userId.toString() && m.role === 'admin'
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: '❌ Not authorized' });
    }

    const { name, description, logo, minLevel } = req.body;
    if (name) agency.name = name;
    if (description !== undefined) agency.description = description;
    if (logo !== undefined) agency.logo = logo;
    if (minLevel) agency.minLevel = minLevel;

    await agency.save();

    res.json({ message: '✅ Agency updated', agency });
  } catch (error) {
    console.error('Update agency error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

const User = require('../models/User');
const Message = require('../models/Message');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const { createNotification } = require('./notificationController');

// @desc    Get my own profile
// @route   GET /api/users/me
// @access  Private
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password -resetCode -resetCodeExpires')
      .populate('agency', 'name logo');
    if (!user) {
      return res.status(404).json({ message: '❌ User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/users/:id
// @access  Public
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -fcmToken -email -resetCode -resetCodeExpires')
      .populate('agency', 'name logo');

    if (!user) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { username, bio, avatar, gender, age, country } = req.body;

    if (username) {
      // Check if username is taken
      const existing = await User.findOne({ username, _id: { $ne: req.userId } });
      if (existing) {
        return res.status(400).json({ message: '❌ Username already taken' });
      }
      req.user.username = username;
    }

    if (bio !== undefined) req.user.bio = bio;
    if (avatar !== undefined) req.user.avatar = avatar;
    if (gender) req.user.gender = gender;
    if (age) req.user.age = age;
    if (country !== undefined) req.user.country = country;

    await req.user.save();

    res.json({
      message: '✅ Profile updated',
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        avatar: req.user.avatar,
        bio: req.user.bio,
        gender: req.user.gender,
        age: req.user.age,
        country: req.user.country,
        coins: req.user.coins,
        diamonds: req.user.diamonds,
        level: req.user.level,
        isVIP: req.user.isVIP
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Upload avatar image
// @route   POST /api/users/avatar
// @access  Private
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '❌ No image file provided' });
    }

    // Delete old avatar from Cloudinary if exists
    if (req.user.avatarPublicId) {
      await deleteFromCloudinary(req.user.avatarPublicId);
    }

    // Upload new avatar
    const { url, public_id } = await uploadToCloudinary(req.file.buffer, 'avatars');

    // Update user
    req.user.avatar = url;
    req.user.avatarPublicId = public_id;
    await req.user.save();

    res.json({
      message: '✅ Avatar uploaded',
      avatar: url
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: '❌ Failed to upload avatar', error: error.message });
  }
};

// @desc    Check if username is available
// @route   GET /api/users/check-username/:username
// @access  Public
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username || username.length < 3) {
      return res.json({ available: false, message: '❌ Username too short (min 3 chars)' });
    }

    const existing = await User.findOne({ username });
    res.json({ available: !existing });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get user messages
// @route   GET /api/users/:id/messages
// @access  Public
exports.getUserMessages = async (req, res) => {
  try {
    const messages = await Message.find({ sender: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('room', 'name');

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Search users
// @route   GET /api/users/search/:query
// @access  Public
exports.searchUsers = async (req, res) => {
  try {
    const query = req.params.query;
    if (!query || query.length < 2) {
      return res.status(400).json({ message: '❌ Query too short' });
    }

    const users = await User.find({
      username: { $regex: query, $options: 'i' }
    })
      .select('username avatar level isVIP gender country')
      .limit(20);

    res.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get top users (leaderboard)
// @route   GET /api/users/leaderboard
// @access  Public
exports.getLeaderboard = async (req, res) => {
  try {
    const { type = 'gifts' } = req.query;

    let sortField = 'giftsReceived';
    if (type === 'level') sortField = 'level';
    if (type === 'rich') sortField = 'coins';

    const users = await User.find({})
      .select('username avatar level giftsReceived coins isVIP')
      .sort({ [sortField]: -1 })
      .limit(50);

    res.json({ users });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 🖼️ COVER IMAGE
// ============================================

// @desc    Upload cover image
// @route   POST /api/users/cover
// @access  Private
exports.uploadCover = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '❌ No image file provided' });
    }

    // Delete old cover from Cloudinary if exists
    if (req.user.coverPublicId) {
      await deleteFromCloudinary(req.user.coverPublicId);
    }

    const { url, public_id } = await uploadToCloudinary(req.file.buffer, 'covers');

    req.user.coverImage = url;
    req.user.coverPublicId = public_id;
    await req.user.save();

    res.json({ message: '✅ Cover uploaded', coverImage: url });
  } catch (error) {
    console.error('Upload cover error:', error);
    res.status(500).json({ message: '❌ Failed to upload cover', error: error.message });
  }
};

// ============================================
// 📸 PHOTO GALLERY
// ============================================

// @desc    Add photo to gallery (max 6)
// @route   POST /api/users/photos
// @access  Private
exports.addPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '❌ No image file provided' });
    }

    if (req.user.photos && req.user.photos.length >= 6) {
      return res.status(400).json({ message: '❌ Gallery full (max 6 photos). Remove one first.' });
    }

    const { url, public_id } = await uploadToCloudinary(req.file.buffer, 'gallery');

    req.user.photos.push({ url, publicId: public_id });
    await req.user.save();

    res.status(201).json({
      message: '✅ Photo added',
      photo: { url, publicId: public_id },
      photos: req.user.photos
    });
  } catch (error) {
    console.error('Add photo error:', error);
    res.status(500).json({ message: '❌ Failed to add photo', error: error.message });
  }
};

// @desc    Remove photo from gallery
// @route   DELETE /api/users/photos/:photoId
// @access  Private
exports.removePhoto = async (req, res) => {
  try {
    const photo = req.user.photos.id(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ message: '❌ Photo not found' });
    }

    // Delete from Cloudinary
    if (photo.publicId) {
      await deleteFromCloudinary(photo.publicId);
    }

    req.user.photos.pull(req.params.photoId);
    await req.user.save();

    res.json({ message: '✅ Photo removed', photos: req.user.photos });
  } catch (error) {
    console.error('Remove photo error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 🚫 BLOCK / UNBLOCK USERS
// ============================================

// @desc    Block a user
// @route   POST /api/users/block/:userId
// @access  Private
exports.blockUser = async (req, res) => {
  try {
    const targetId = req.params.userId;

    if (targetId === req.userId.toString()) {
      return res.status(400).json({ message: '❌ Cannot block yourself' });
    }

    const target = await User.findById(targetId);
    if (!target) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    // Check if already blocked
    if (req.user.blockedUsers.some(id => id.toString() === targetId)) {
      return res.status(400).json({ message: '❌ User already blocked' });
    }

    req.user.blockedUsers.push(targetId);

    // Also unfollow each other
    req.user.following = req.user.following.filter(id => id.toString() !== targetId);
    target.following = target.following.filter(id => id.toString() !== req.userId.toString());

    await req.user.save();
    await target.save();

    res.json({ message: `✅ Blocked ${target.username}` });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Unblock a user
// @route   DELETE /api/users/block/:userId
// @access  Private
exports.unblockUser = async (req, res) => {
  try {
    const targetId = req.params.userId;

    req.user.blockedUsers = req.user.blockedUsers.filter(
      id => id.toString() !== targetId
    );
    await req.user.save();

    res.json({ message: '✅ User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get my blocked users list
// @route   GET /api/users/blocked
// @access  Private
exports.getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('blockedUsers', 'username avatar level isVIP');
    res.json({ blocked: user.blockedUsers });
  } catch (error) {
    console.error('Get blocked error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 👥 FOLLOW / UNFOLLOW
// ============================================

// @desc    Follow a user
// @route   POST /api/users/follow/:userId
// @access  Private
exports.followUser = async (req, res) => {
  try {
    const targetId = req.params.userId;

    if (targetId === req.userId.toString()) {
      return res.status(400).json({ message: '❌ Cannot follow yourself' });
    }

    const target = await User.findById(targetId);
    if (!target) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    // Check if blocked
    if (req.user.blockedUsers.some(id => id.toString() === targetId)) {
      return res.status(400).json({ message: '❌ Unblock user first' });
    }

    if (req.user.following.some(id => id.toString() === targetId)) {
      return res.status(400).json({ message: '❌ Already following' });
    }

    req.user.following.push(targetId);
    req.user.followingCount = req.user.following.length;

    // Increment target's followers count
    target.followersCount = (target.followersCount || 0) + 1;

    // Send notification (save to DB + push + socket)
    await createNotification({
      recipient: targetId,
      sender: req.userId,
      type: 'follow',
      title: '👥 New Follower',
      body: `${req.user.username} started following you!`,
      referenceId: req.userId,
      referenceType: 'user'
    });

    await req.user.save();
    await target.save();

    res.json({
      message: `✅ Following ${target.username}`,
      followingCount: req.user.followingCount
    });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/users/follow/:userId
// @access  Private
exports.unfollowUser = async (req, res) => {
  try {
    const targetId = req.params.userId;

    req.user.following = req.user.following.filter(id => id.toString() !== targetId);
    req.user.followingCount = req.user.following.length;

    // Decrement target's followers count
    const target = await User.findById(targetId);
    if (target) {
      target.followersCount = Math.max(0, (target.followersCount || 0) - 1);
      await target.save();
    }

    await req.user.save();

    res.json({ message: '✅ Unfollowed', followingCount: req.user.followingCount });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get my following list
// @route   GET /api/users/following
// @access  Private
exports.getFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('following', 'username avatar level isVIP isOnline');
    res.json({ following: user.following, count: user.followingCount });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// ⚙️ SETTINGS & SOCIAL LINKS
// ============================================

// @desc    Update settings
// @route   PUT /api/users/settings
// @access  Private
exports.updateSettings = async (req, res) => {
  try {
    const { isPrivate, showOnline, allowMessages, allowGifts, notifications } = req.body;

    if (isPrivate !== undefined) req.user.settings.isPrivate = isPrivate;
    if (showOnline !== undefined) req.user.settings.showOnline = showOnline;
    if (allowMessages !== undefined) req.user.settings.allowMessages = allowMessages;
    if (allowGifts !== undefined) req.user.settings.allowGifts = allowGifts;

    if (notifications && typeof notifications === 'object') {
      for (const [key, val] of Object.entries(notifications)) {
        if (['likes', 'comments', 'follows', 'followers', 'gifts', 'messages', 'rooms'].includes(key)) {
          req.user.settings.notifications[key] = val;
        }
      }
    }

    await req.user.save();

    res.json({ message: '✅ Settings updated', settings: req.user.settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Update social links
// @route   PUT /api/users/social-links
// @access  Private
exports.updateSocialLinks = async (req, res) => {
  try {
    const { instagram, tiktok, snapchat, twitter } = req.body;

    if (instagram !== undefined) req.user.socialLinks.instagram = instagram;
    if (tiktok !== undefined) req.user.socialLinks.tiktok = tiktok;
    if (snapchat !== undefined) req.user.socialLinks.snapchat = snapchat;
    if (twitter !== undefined) req.user.socialLinks.twitter = twitter;

    await req.user.save();

    res.json({ message: '✅ Social links updated', socialLinks: req.user.socialLinks });
  } catch (error) {
    console.error('Update social links error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 📊 PROFILE STATS
// ============================================

// @desc    Get profile completeness (how complete the profile is)
// @route   GET /api/users/profile-stats
// @access  Private
exports.getProfileStats = async (req, res) => {
  try {
    const u = req.user;
    const fields = {
      avatar: !!u.avatar,
      coverImage: !!u.coverImage,
      bio: !!u.bio,
      country: !!u.country,
      gender: !!u.gender,
      age: u.age > 0,
      photos: u.photos && u.photos.length > 0,
      socialLinks: Object.values(u.socialLinks.toObject()).some(v => v)
    };

    const completed = Object.values(fields).filter(Boolean).length;
    const total = Object.keys(fields).length;
    const percentage = Math.round((completed / total) * 100);

    res.json({
      completeness: percentage,
      completed,
      total,
      fields,
      followersCount: u.followersCount,
      followingCount: u.followingCount,
      profileVisits: u.profileVisits,
      giftsReceived: u.giftsReceived,
      photosCount: u.photos ? u.photos.length : 0
    });
  } catch (error) {
    console.error('Profile stats error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

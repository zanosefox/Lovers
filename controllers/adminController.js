const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Gift = require('../models/Gift');
const AuditLog = require('../models/AuditLog');
const Agency = require('../models/Agency');
const { createNotification } = require('./notificationController');

// ============================================
// 📋 HELPER: Log admin action
// ============================================

const logAction = async ({
  admin,
  action,
  targetType,
  targetId = null,
  summary = '',
  metadata = {},
  ip = ''
}) => {
  try {
    await AuditLog.create({
      admin,
      action,
      targetType,
      targetId,
      summary,
      metadata,
      ip
    });
  } catch (err) {
    console.error('Failed to log admin action:', err.message);
  }
};

// ============================================
// 📊 DASHBOARD / STATS
// ============================================

/**
 * @desc    Get admin dashboard stats
 * @route   GET /api/admin/dashboard
 * @access  Private (admin)
 */
exports.getDashboard = async (req, res) => {
  try {
    const [totalUsers, onlineUsers, bannedUsers, totalPosts, totalGifts, totalAgencies] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isOnline: true }),
        User.countDocuments({ isBanned: true }),
        Post.countDocuments(),
        Gift.countDocuments({ isActive: true }),
        Agency.countDocuments()
      ]);

    // Reported posts (posts with 1+ reports)
    const reportedPosts = await Post.countDocuments({ reportsCount: { $gt: 0 }, isHidden: false });
    // Reported comments
    const reportedComments = await Comment.countDocuments({ reportsCount: { $gt: 0 }, isHidden: false });

    res.json({
      users: { total: totalUsers, online: onlineUsers, banned: bannedUsers },
      posts: { total: totalPosts, reported: reportedPosts },
      comments: { reported: reportedComments },
      gifts: { total: totalGifts },
      agencies: { total: totalAgencies }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 👥 USER MANAGEMENT
// ============================================

/**
 * @desc    Get all users (paginated, searchable)
 * @route   GET /api/admin/users
 * @access  Private (admin)
 */
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const search = req.query.search || '';
    const status = req.query.status; // 'active', 'banned', 'admin'

    const query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status === 'banned') query.isBanned = true;
    if (status === 'admin') query.isAdmin = true;
    if (status === 'active') { query.isBanned = false; query.isAdmin = false; }

    const users = await User.find(query)
      .select('-password -resetCode -resetCodeExpires -fcmToken -settings')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Get single user details (admin view)
 * @route   GET /api/admin/users/:id
 * @access  Private (admin)
 */
exports.getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetCode -resetCodeExpires')
      .populate('agency', 'name logo');

    if (!user) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    // Get extra stats
    const postCount = await Post.countDocuments({ author: user._id });
    const commentCount = await Comment.countDocuments({ author: user._id });

    res.json({
      user,
      stats: { postCount, commentCount }
    });
  } catch (error) {
    console.error('Admin get user details error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Ban a user
 * @route   POST /api/admin/users/:id/ban
 * @access  Private (admin)
 */
exports.banUser = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: '❌ Ban reason is required' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    // Cannot ban admins (only super_admin can ban other admins)
    if (targetUser.isAdmin && req.user.adminRole !== 'super_admin') {
      return res.status(403).json({ message: '❌ Cannot ban another admin' });
    }

    // Cannot ban yourself
    if (targetUser._id.toString() === req.userId.toString()) {
      return res.status(400).json({ message: '❌ Cannot ban yourself' });
    }

    if (targetUser.isBanned) {
      return res.status(400).json({ message: '❌ User is already banned' });
    }

    targetUser.isBanned = true;
    targetUser.bannedAt = new Date();
    targetUser.bannedReason = reason.trim();
    targetUser.bannedBy = req.userId;
    await targetUser.save();

    // Log action
    await logAction({
      admin: req.userId,
      action: 'ban_user',
      targetType: 'user',
      targetId: targetUser._id,
      summary: `Banned user @${targetUser.username} — Reason: ${reason.trim()}`,
      metadata: { username: targetUser.username, reason: reason.trim() },
      ip: req.ip
    });

    // Notify user
    await createNotification({
      recipient: targetUser._id,
      sender: req.userId,
      type: 'system',
      title: '🚫 Account Banned',
      body: `Your account has been banned. Reason: ${reason.trim()}`,
      pushFCM: true
    });

    // Disconnect user's sockets
    try {
      const { getIo } = require('../config/socketStore');
      const io = getIo();
      if (io) {
        io.to(`user:${targetUser._id}`).emit('user:banned', {
          reason: reason.trim()
        });
      }
    } catch (e) { /* ignore */ }

    res.json({ message: `✅ User @${targetUser.username} banned`, user: { id: targetUser._id, username: targetUser.username } });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Unban a user
 * @route   POST /api/admin/users/:id/unban
 * @access  Private (admin)
 */
exports.unbanUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    if (!targetUser.isBanned) {
      return res.status(400).json({ message: '❌ User is not banned' });
    }

    targetUser.isBanned = false;
    targetUser.bannedAt = null;
    targetUser.bannedReason = '';
    targetUser.bannedBy = null;
    await targetUser.save();

    // Log action
    await logAction({
      admin: req.userId,
      action: 'unban_user',
      targetType: 'user',
      targetId: targetUser._id,
      summary: `Unbanned user @${targetUser.username}`,
      metadata: { username: targetUser.username },
      ip: req.ip
    });

    // Notify user
    await createNotification({
      recipient: targetUser._id,
      sender: req.userId,
      type: 'system',
      title: '✅ Account Unbanned',
      body: 'Your account has been unbanned. Welcome back!',
      pushFCM: true
    });

    res.json({ message: `✅ User @${targetUser.username} unbanned` });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 🏆 VIP MANAGEMENT
// ============================================

/**
 * @desc    Grant VIP to a user
 * @route   POST /api/admin/users/:id/grant-vip
 * @access  Private (super_admin)
 */
exports.grantVIP = async (req, res) => {
  try {
    const { vipLevel = 1 } = req.body;

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    const previousVIP = targetUser.isVIP;
    const previousLevel = targetUser.vipLevel;

    targetUser.isVIP = true;
    targetUser.vipLevel = vipLevel;
    await targetUser.save();

    // Log action
    await logAction({
      admin: req.userId,
      action: 'grant_vip',
      targetType: 'user',
      targetId: targetUser._id,
      summary: `Granted VIP (level ${vipLevel}) to @${targetUser.username}`,
      metadata: {
        username: targetUser.username,
        vipLevel,
        previousVIP,
        previousLevel
      },
      ip: req.ip
    });

    // Notify user
    await createNotification({
      recipient: targetUser._id,
      sender: req.userId,
      type: 'system',
      title: '👑 VIP Granted!',
      body: `You have been granted VIP level ${vipLevel}!`,
      pushFCM: true
    });

    res.json({ message: `✅ VIP granted to @${targetUser.username}`, vipLevel });
  } catch (error) {
    console.error('Grant VIP error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Revoke VIP from a user
 * @route   POST /api/admin/users/:id/revoke-vip
 * @access  Private (super_admin)
 */
exports.revokeVIP = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    const previousVIP = targetUser.isVIP;
    const previousLevel = targetUser.vipLevel;

    targetUser.isVIP = false;
    targetUser.vipLevel = 0;
    await targetUser.save();

    // Log action
    await logAction({
      admin: req.userId,
      action: 'revoke_vip',
      targetType: 'user',
      targetId: targetUser._id,
      summary: `Revoked VIP from @${targetUser.username}`,
      metadata: {
        username: targetUser.username,
        previousVIP,
        previousLevel
      },
      ip: req.ip
    });

    await createNotification({
      recipient: targetUser._id,
      sender: req.userId,
      type: 'system',
      title: '👑 VIP Revoked',
      body: 'Your VIP status has been removed.',
      pushFCM: true
    });

    res.json({ message: `✅ VIP revoked from @${targetUser.username}` });
  } catch (error) {
    console.error('Revoke VIP error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 💰 BALANCE ADJUSTMENT
// ============================================

/**
 * @desc    Adjust user balance (coins/diamonds)
 * @route   POST /api/admin/users/:id/adjust-balance
 * @access  Private (super_admin)
 */
exports.adjustBalance = async (req, res) => {
  try {
    const { coins, diamonds, reason } = req.body;

    if (coins === undefined && diamonds === undefined) {
      return res.status(400).json({ message: '❌ Provide coins and/or diamonds to adjust' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    const previousCoins = targetUser.coins;
    const previousDiamonds = targetUser.diamonds;

    if (coins !== undefined) targetUser.coins += coins;
    if (diamonds !== undefined) targetUser.diamonds += diamonds;

    // Ensure non-negative
    targetUser.coins = Math.max(0, targetUser.coins);
    targetUser.diamonds = Math.max(0, targetUser.diamonds);

    await targetUser.save();

    // Log action
    await logAction({
      admin: req.userId,
      action: 'adjust_balance',
      targetType: 'user',
      targetId: targetUser._id,
      summary: `Adjusted balance for @${targetUser.username}: coins ${previousCoins}→${targetUser.coins}, diamonds ${previousDiamonds}→${targetUser.diamonds}`,
      metadata: {
        username: targetUser.username,
        coinsDelta: coins || 0,
        diamondsDelta: diamonds || 0,
        previousCoins,
        previousDiamonds,
        newCoins: targetUser.coins,
        newDiamonds: targetUser.diamonds,
        reason: reason || ''
      },
      ip: req.ip
    });

    res.json({
      message: `✅ Balance adjusted for @${targetUser.username}`,
      balance: { coins: targetUser.coins, diamonds: targetUser.diamonds }
    });
  } catch (error) {
    console.error('Adjust balance error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 📝 POST MODERATION
// ============================================

/**
 * @desc    Get reported posts
 * @route   GET /api/admin/posts/reported
 * @access  Private (admin)
 */
exports.getReportedPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const posts = await Post.find({ reportsCount: { $gt: 0 }, isHidden: false })
      .populate('author', 'username avatar level isVIP')
      .sort({ reportsCount: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Post.countDocuments({ reportsCount: { $gt: 0 }, isHidden: false });

    res.json({ posts, page, totalPages: Math.ceil(total / limit), total });
  } catch (error) {
    console.error('Get reported posts error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Hide a post (soft moderation)
 * @route   POST /api/admin/posts/:id/hide
 * @access  Private (admin)
 */
exports.hidePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: '❌ Post not found' });
    }

    if (post.isHidden) {
      return res.status(400).json({ message: '❌ Post is already hidden' });
    }

    post.isHidden = true;
    await post.save();

    await logAction({
      admin: req.userId,
      action: 'hide_post',
      targetType: 'post',
      targetId: post._id,
      summary: `Hidden post by @${post.author}`,
      metadata: { authorId: post.author },
      ip: req.ip
    });

    res.json({ message: '✅ Post hidden' });
  } catch (error) {
    console.error('Hide post error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Unhide a post
 * @route   POST /api/admin/posts/:id/unhide
 * @access  Private (admin)
 */
exports.unhidePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: '❌ Post not found' });
    }

    if (!post.isHidden) {
      return res.status(400).json({ message: '❌ Post is not hidden' });
    }

    post.isHidden = false;
    await post.save();

    await logAction({
      admin: req.userId,
      action: 'unhide_post',
      targetType: 'post',
      targetId: post._id,
      summary: `Unhidden post by @${post.author}`,
      metadata: { authorId: post.author },
      ip: req.ip
    });

    res.json({ message: '✅ Post unhidden' });
  } catch (error) {
    console.error('Unhide post error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Delete a post (admin override)
 * @route   DELETE /api/admin/posts/:id
 * @access  Private (admin)
 */
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: '❌ Post not found' });
    }

    // Delete media from Cloudinary
    for (const m of post.media) {
      if (m.publicId) {
        try {
          const { deleteFromCloudinary } = require('../config/cloudinary');
          await deleteFromCloudinary(m.publicId);
        } catch (e) { /* ignore cloud errors */ }
      }
    }

    // Delete all comments
    await Comment.deleteMany({ post: post._id });
    await Post.findByIdAndDelete(post._id);

    await logAction({
      admin: req.userId,
      action: 'delete_post',
      targetType: 'post',
      targetId: post._id,
      summary: `Deleted post by @${post.author} (admin action)`,
      metadata: { authorId: post.author },
      ip: req.ip
    });

    res.json({ message: '✅ Post deleted' });
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 💬 COMMENT MODERATION
// ============================================

/**
 * @desc    Get reported comments
 * @route   GET /api/admin/comments/reported
 * @access  Private (admin)
 */
exports.getReportedComments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const comments = await Comment.find({ reportsCount: { $gt: 0 }, isHidden: false })
      .populate('author', 'username avatar level isVIP')
      .populate('post', 'text author')
      .sort({ reportsCount: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Comment.countDocuments({ reportsCount: { $gt: 0 }, isHidden: false });

    res.json({ comments, page, totalPages: Math.ceil(total / limit), total });
  } catch (error) {
    console.error('Get reported comments error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Hide a comment
 * @route   POST /api/admin/comments/:id/hide
 * @access  Private (admin)
 */
exports.hideComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: '❌ Comment not found' });
    }

    if (comment.isHidden) {
      return res.status(400).json({ message: '❌ Comment is already hidden' });
    }

    comment.isHidden = true;
    await comment.save();

    // Decrement post comment count
    await Post.findByIdAndUpdate(comment.post, { $inc: { commentsCount: -1 } }).catch(() => {});

    await logAction({
      admin: req.userId,
      action: 'hide_comment',
      targetType: 'comment',
      targetId: comment._id,
      summary: `Hidden comment on post ${comment.post}`,
      metadata: { authorId: comment.author, postId: comment.post },
      ip: req.ip
    });

    res.json({ message: '✅ Comment hidden' });
  } catch (error) {
    console.error('Hide comment error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 🎁 GIFT MANAGEMENT
// ============================================

/**
 * @desc    Create a new gift
 * @route   POST /api/admin/gifts
 * @access  Private (admin)
 */
exports.createGift = async (req, res) => {
  try {
    const { name, icon, image, coinValue, diamondValue, rarity, category } = req.body;

    if (!name || !icon || coinValue === undefined) {
      return res.status(400).json({ message: '❌ name, icon, and coinValue are required' });
    }

    const existing = await Gift.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: '❌ Gift name already exists' });
    }

    const gift = await Gift.create({
      name,
      icon,
      image: image || '',
      coinValue,
      diamondValue: diamondValue || 0,
      rarity: rarity || 'common',
      category: category || 'fun'
    });

    await logAction({
      admin: req.userId,
      action: 'create_gift',
      targetType: 'gift',
      targetId: gift._id,
      summary: `Created gift: ${gift.icon} ${gift.name} (${gift.coinValue} coins)`,
      metadata: { name, icon, coinValue, rarity, category },
      ip: req.ip
    });

    res.status(201).json({ message: '✅ Gift created', gift });
  } catch (error) {
    console.error('Create gift error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Update a gift
 * @route   PUT /api/admin/gifts/:id
 * @access  Private (admin)
 */
exports.updateGift = async (req, res) => {
  try {
    const gift = await Gift.findById(req.params.id);
    if (!gift) {
      return res.status(404).json({ message: '❌ Gift not found' });
    }

    const { name, icon, image, coinValue, diamondValue, rarity, category } = req.body;

    if (name) gift.name = name;
    if (icon) gift.icon = icon;
    if (image !== undefined) gift.image = image;
    if (coinValue !== undefined) gift.coinValue = coinValue;
    if (diamondValue !== undefined) gift.diamondValue = diamondValue;
    if (rarity) gift.rarity = rarity;
    if (category) gift.category = category;

    await gift.save();

    await logAction({
      admin: req.userId,
      action: 'update_gift',
      targetType: 'gift',
      targetId: gift._id,
      summary: `Updated gift: ${gift.icon} ${gift.name}`,
      metadata: { name: gift.name, icon: gift.icon, coinValue: gift.coinValue },
      ip: req.ip
    });

    res.json({ message: '✅ Gift updated', gift });
  } catch (error) {
    console.error('Update gift error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Delete a gift
 * @route   DELETE /api/admin/gifts/:id
 * @access  Private (super_admin)
 */
exports.deleteGift = async (req, res) => {
  try {
    const gift = await Gift.findById(req.params.id);
    if (!gift) {
      return res.status(404).json({ message: '❌ Gift not found' });
    }

    await Gift.findByIdAndDelete(gift._id);

    await logAction({
      admin: req.userId,
      action: 'delete_gift',
      targetType: 'gift',
      targetId: gift._id,
      summary: `Deleted gift: ${gift.icon} ${gift.name}`,
      metadata: { name: gift.name, icon: gift.icon },
      ip: req.ip
    });

    res.json({ message: '✅ Gift deleted' });
  } catch (error) {
    console.error('Delete gift error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Toggle gift active status
 * @route   POST /api/admin/gifts/:id/toggle
 * @access  Private (admin)
 */
exports.toggleGift = async (req, res) => {
  try {
    const gift = await Gift.findById(req.params.id);
    if (!gift) {
      return res.status(404).json({ message: '❌ Gift not found' });
    }

    gift.isActive = !gift.isActive;
    await gift.save();

    await logAction({
      admin: req.userId,
      action: 'toggle_gift',
      targetType: 'gift',
      targetId: gift._id,
      summary: `${gift.isActive ? 'Activated' : 'Deactivated'} gift: ${gift.icon} ${gift.name}`,
      metadata: { name: gift.name, isActive: gift.isActive },
      ip: req.ip
    });

    res.json({
      message: `✅ Gift ${gift.isActive ? 'activated' : 'deactivated'}`,
      gift: { id: gift._id, name: gift.name, isActive: gift.isActive }
    });
  } catch (error) {
    console.error('Toggle gift error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 🏛️ AGENCY VERIFICATION
// ============================================

/**
 * @desc    Get all agencies (admin view)
 * @route   GET /api/admin/agencies
 * @access  Private (admin)
 */
exports.getAgencies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const agencies = await Agency.find({})
      .populate('owner', 'username avatar level')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Agency.countDocuments();

    res.json({ agencies, page, totalPages: Math.ceil(total / limit), total });
  } catch (error) {
    console.error('Admin get agencies error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

/**
 * @desc    Verify an agency
 * @route   POST /api/admin/agencies/:id/verify
 * @access  Private (super_admin)
 */
exports.verifyAgency = async (req, res) => {
  try {
    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ message: '❌ Agency not found' });
    }

    agency.isVerified = !agency.isVerified;
    await agency.save();

    await logAction({
      admin: req.userId,
      action: 'verify_agency',
      targetType: 'agency',
      targetId: agency._id,
      summary: `${agency.isVerified ? 'Verified' : 'Unverified'} agency: ${agency.name}`,
      metadata: { agencyName: agency.name, isVerified: agency.isVerified },
      ip: req.ip
    });

    // Notify agency owner
    await createNotification({
      recipient: agency.owner,
      sender: req.userId,
      type: 'system',
      title: agency.isVerified ? '✅ Agency Verified!' : '⚠️ Agency Unverified',
      body: agency.isVerified
        ? `Your agency "${agency.name}" has been verified!`
        : `Your agency "${agency.name}" verification has been removed.`,
      referenceId: agency._id,
      referenceType: 'agency',
      pushFCM: true
    });

    res.json({
      message: `✅ Agency ${agency.isVerified ? 'verified' : 'unverified'}`,
      agency: { id: agency._id, name: agency.name, isVerified: agency.isVerified }
    });
  } catch (error) {
    console.error('Verify agency error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 📋 AUDIT LOGS
// ============================================

/**
 * @desc    Get audit logs (paginated, filterable)
 * @route   GET /api/admin/audit-logs
 * @access  Private (admin)
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const action = req.query.action;
    const adminId = req.query.adminId;

    const query = {};
    if (action) query.action = action;
    if (adminId) query.admin = adminId;

    const logs = await AuditLog.find(query)
      .populate('admin', 'username avatar adminRole')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await AuditLog.countDocuments(query);

    res.json({ logs, page, totalPages: Math.ceil(total / limit), total });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

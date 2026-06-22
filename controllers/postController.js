const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const { createNotification } = require('./notificationController');

// Helper: extract hashtags from text (#word)
const extractHashtags = (text) => {
  if (!text) return [];
  const matches = text.match(/#[\w\u0600-\u06FF]+/g) || [];
  return matches.map(tag => tag.slice(1).toLowerCase());
};

// Helper: extract @mentions from text
const extractMentions = (text) => {
  if (!text) return [];
  const matches = text.match(/@[\w\u0600-\u06FF]+/g) || [];
  return [...new Set(matches.map(m => m.slice(1)))]; // unique usernames
};

// Helper: send mention notifications for found users
const sendMentionNotifications = async (text, senderId, senderName, referenceId, referenceType) => {
  const usernames = extractMentions(text);
  if (!usernames.length) return;

  const mentionedUsers = await User.find({ username: { $in: usernames } }).select('_id');
  for (const user of mentionedUsers) {
    if (user._id.toString() !== senderId.toString()) {
      await createNotification({
        recipient: user._id,
        sender: senderId,
        type: 'mention',
        title: '📢 You were mentioned',
        body: `${senderName} mentioned you in a ${referenceType}`,
        referenceId,
        referenceType,
        data: { mentionText: text.slice(0, 100) }
      });
    }
  }
};

// Helper: format a post with author info
const formatPost = (post, currentUserId = null) => {
  const obj = post.toObject ? post.toObject() : post;
  return {
    id: obj._id,
    author: obj.author,
    text: obj.text,
    media: obj.media,
    likesCount: obj.likesCount,
    commentsCount: obj.commentsCount,
    sharesCount: obj.sharesCount,
    hashtags: obj.hashtags,
    location: obj.location,
    visibility: obj.visibility,
    likedByMe: currentUserId
      ? (obj.likes || []).some(l => l.user && l.user.toString() === currentUserId.toString())
      : false,
    createdAt: obj.createdAt
  };
};

// ============================================
// 📝 CREATE POST
// ============================================

// @desc    Create a text-only post
// @route   POST /api/posts
// @access  Private
exports.createPost = async (req, res) => {
  try {
    const { text, location, visibility } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: '❌ Post text is required' });
    }

    if (text.length > 2000) {
      return res.status(400).json({ message: '❌ Text too long (max 2000 chars)' });
    }

    const post = await Post.create({
      author: req.userId,
      text: text.trim(),
      hashtags: extractHashtags(text),
      location: location || '',
      visibility: visibility || 'public'
    });

    await post.populate('author', 'username avatar level isVIP gender');

    // Send mention notifications
    await sendMentionNotifications(text.trim(), req.userId, req.user.username, post._id, 'post').catch(() => {});

    res.status(201).json({
      post: formatPost(post, req.userId)
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Create a post with image(s)
// @route   POST /api/posts/with-media
// @access  Private
exports.createPostWithMedia = async (req, res) => {
  try {
    const { text, location, visibility } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: '❌ No media files provided' });
    }

    if (req.files.length > 4) {
      return res.status(400).json({ message: '❌ Max 4 images per post' });
    }

    // Upload all images to Cloudinary
    const media = [];
    for (const file of req.files) {
      const { url, public_id } = await uploadToCloudinary(file.buffer, 'posts');
      media.push({ url, publicId: public_id, type: 'image' });
    }

    const post = await Post.create({
      author: req.userId,
      text: (text || '').trim(),
      media,
      hashtags: extractHashtags(text || ''),
      location: location || '',
      visibility: visibility || 'public'
    });

    await post.populate('author', 'username avatar level isVIP gender');

    // Send mention notifications
    await sendMentionNotifications((text || '').trim(), req.userId, req.user.username, post._id, 'post').catch(() => {});

    res.status(201).json({
      message: '✅ Post with media created',
      post: formatPost(post, req.userId)
    });
  } catch (error) {
    console.error('Create post with media error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 📖 READ / FEED
// ============================================

// @desc    Get feed (all public posts, paginated)
// @route   GET /api/posts/feed
// @access  Public
exports.getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const posts = await Post.find({ visibility: 'public', isHidden: false })
      .populate('author', 'username avatar level isVIP gender')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Post.countDocuments({ visibility: 'public', isHidden: false });

    res.json({
      posts: posts.map(p => formatPost(p, req.userId || null)),
      page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get posts by hashtag
// @route   GET /api/posts/hashtag/:tag
// @access  Public
exports.getPostsByHashtag = async (req, res) => {
  try {
    const tag = req.params.tag.toLowerCase().replace(/^#/, '');
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const posts = await Post.find({
      hashtags: tag,
      visibility: 'public',
      isHidden: false
    })
      .populate('author', 'username avatar level isVIP gender')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Post.countDocuments({
      hashtags: tag, visibility: 'public', isHidden: false
    });

    res.json({
      tag: '#' + tag,
      posts: posts.map(p => formatPost(p, req.userId || null)),
      page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Get hashtag posts error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get single post by ID
// @route   GET /api/posts/:id
// @access  Public
exports.getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username avatar level isVIP gender');

    if (!post) {
      return res.status(404).json({ message: '❌ Post not found' });
    }

    if (post.isHidden) {
      return res.status(404).json({ message: '❌ Post not found' });
    }

    res.json({ post: formatPost(post, req.userId || null) });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get posts by a user
// @route   GET /api/posts/user/:userId
// @access  Public
exports.getUserPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const query = { author: req.params.userId, isHidden: false };
    // If not the author, only show public posts
    if (req.userId !== req.params.userId) {
      query.visibility = 'public';
    }

    const posts = await Post.find(query)
      .populate('author', 'username avatar level isVIP gender')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Post.countDocuments(query);

    res.json({
      posts: posts.map(p => formatPost(p, req.userId || null)),
      page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// ❤️ LIKE / UNLIKE
// ============================================

// @desc    Like a post
// @route   POST /api/posts/:id/like
// @access  Private
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: '❌ Post not found' });
    }

    // Check if already liked
    const alreadyLiked = post.likes.some(
      l => l.user.toString() === req.userId.toString()
    );

    if (alreadyLiked) {
      return res.status(400).json({ message: '❌ Already liked' });
    }

    post.likes.push({ user: req.userId });
    post.likesCount = post.likes.length;
    await post.save();

    // Notify author (save to DB + push + socket)
    await createNotification({
      recipient: post.author,
      sender: req.userId,
      type: 'like',
      title: '❤️ New Like',
      body: `${req.user.username} liked your post!`,
      referenceId: post._id,
      referenceType: 'post'
    });

    res.json({ message: '✅ Liked', likesCount: post.likesCount });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Unlike a post
// @route   DELETE /api/posts/:id/like
// @access  Private
exports.unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: '❌ Post not found' });
    }

    post.likes = post.likes.filter(l => l.user.toString() !== req.userId.toString());
    post.likesCount = post.likes.length;
    await post.save();

    res.json({ message: '✅ Unliked', likesCount: post.likesCount });
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 💬 COMMENTS
// ============================================

// @desc    Get comments for a post
// @route   GET /api/posts/:id/comments
// @access  Public
exports.getComments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const comments = await Comment.find({
      post: req.params.id,
      isHidden: false,
      parentComment: null
    })
      .populate('author', 'username avatar level isVIP')
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      comments: comments.map(c => ({
        id: c._id,
        author: c.author,
        text: c.text,
        likesCount: c.likesCount,
        likedByMe: (c.likes || []).some(l => l.user && l.user.toString() === (req.userId || '').toString()),
        createdAt: c.createdAt
      }))
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Add a comment to a post
// @route   POST /api/posts/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: '❌ Comment text is required' });
    }
    if (text.length > 500) {
      return res.status(400).json({ message: '❌ Comment too long (max 500)' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: '❌ Post not found' });
    }

    const comment = await Comment.create({
      post: post._id,
      author: req.userId,
      text: text.trim()
    });

    // Increment comment count on post
    post.commentsCount += 1;
    await post.save();

    await comment.populate('author', 'username avatar level isVIP');

    // Notify post author (save to DB + push + socket)
    await createNotification({
      recipient: post.author,
      sender: req.userId,
      type: 'comment',
      title: '💬 New Comment',
      body: `${req.user.username} commented: "${text.trim().slice(0, 40)}"`,
      referenceId: post._id,
      referenceType: 'post',
      data: { commentId: comment._id.toString() }
    });

    // Send mention notifications in comment
    await sendMentionNotifications(text.trim(), req.userId, req.user.username, comment._id, 'comment').catch(() => {});

    res.status(201).json({
      message: '✅ Comment added',
      comment: {
        id: comment._id,
        author: comment.author,
        text: comment.text,
        likesCount: 0,
        createdAt: comment.createdAt
      }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/posts/:id/comments/:commentId
// @access  Private
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: '❌ Comment not found' });
    }

    // Only author or post owner can delete
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: '❌ Post not found' });
    }

    const isCommentAuthor = comment.author.toString() === req.userId.toString();
    const isPostAuthor = post.author.toString() === req.userId.toString();

    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({ message: '❌ Not authorized' });
    }

    await Comment.findByIdAndDelete(req.params.commentId);
    post.commentsCount = Math.max(0, post.commentsCount - 1);
    await post.save();

    res.json({ message: '✅ Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 🗑️ DELETE POST
// ============================================

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: '❌ Post not found' });
    }

    if (post.author.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: '❌ Not authorized' });
    }

    // Delete media from Cloudinary
    for (const m of post.media) {
      if (m.publicId) {
        await deleteFromCloudinary(m.publicId);
      }
    }

    // Delete all comments
    await Comment.deleteMany({ post: post._id });

    await Post.findByIdAndDelete(post._id);

    res.json({ message: '✅ Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// ============================================
// 📊 STATS / EXPLORE
// ============================================

// @desc    Get trending hashtags
// @route   GET /api/posts/trending
// @access  Public
exports.getTrending = async (req, res) => {
  try {
    // Last 7 days
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await Post.aggregate([
      { $match: { createdAt: { $gte: since }, isHidden: false } },
      { $unwind: '$hashtags' },
      { $group: {
        _id: '$hashtags',
        count: { $sum: 1 },
        totalLikes: { $sum: '$likesCount' }
      }},
      { $sort: { count: -1, totalLikes: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      trending: result.map(t => ({
        tag: '#' + t._id,
        posts: t.count,
        likes: t.totalLikes
      }))
    });
  } catch (error) {
    console.error('Get trending error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Report a post
// @route   POST /api/posts/:id/report
// @access  Private
exports.reportPost = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: '❌ Reason is required' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: '❌ Post not found' });
    }

    // Check if already reported
    const alreadyReported = post.reports.some(
      r => r.reporter.toString() === req.userId.toString()
    );
    if (alreadyReported) {
      return res.status(400).json({ message: '❌ Already reported' });
    }

    post.reports.push({ reporter: req.userId, reason: reason.trim() });
    post.reportsCount = post.reports.length;
    await post.save();

    res.json({ message: '✅ Post reported. Admin will review.' });
  } catch (error) {
    console.error('Report post error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

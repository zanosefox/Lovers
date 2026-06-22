const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { auth, optionalAuth } = require('../middleware/auth');
const { handleUploadErrors, uploadImages } = require('../middleware/upload');

// ============================================
// 📊 EXPLORE
// ============================================

// @route   GET /api/posts/trending
router.get('/trending', postController.getTrending);

// @route   GET /api/posts/feed
router.get('/feed', optionalAuth, postController.getFeed);

// @route   GET /api/posts/hashtag/:tag
router.get('/hashtag/:tag', optionalAuth, postController.getPostsByHashtag);

// @route   GET /api/posts/user/:userId
router.get('/user/:userId', optionalAuth, postController.getUserPosts);

// ============================================
// 📝 CREATE
// ============================================

// @route   POST /api/posts
router.post('/', auth, postController.createPost);

// @route   POST /api/posts/with-media
router.post('/with-media', auth, handleUploadErrors(uploadImages), postController.createPostWithMedia);

// ============================================
// 📖 SINGLE POST
// ============================================

// @route   GET /api/posts/:id
router.get('/:id', optionalAuth, postController.getPost);

// @route   DELETE /api/posts/:id
router.delete('/:id', auth, postController.deletePost);

// ============================================
// ❤️ LIKES
// ============================================

// @route   POST /api/posts/:id/like
router.post('/:id/like', auth, postController.likePost);

// @route   DELETE /api/posts/:id/like
router.delete('/:id/like', auth, postController.unlikePost);

// ============================================
// 💬 COMMENTS
// ============================================

// @route   GET /api/posts/:id/comments
router.get('/:id/comments', optionalAuth, postController.getComments);

// @route   POST /api/posts/:id/comments
router.post('/:id/comments', auth, postController.addComment);

// @route   DELETE /api/posts/:id/comments/:commentId
router.delete('/:id/comments/:commentId', auth, postController.deleteComment);

// ============================================
// 🚩 REPORT
// ============================================

// @route   POST /api/posts/:id/report
router.post('/:id/report', auth, postController.reportPost);

module.exports = router;

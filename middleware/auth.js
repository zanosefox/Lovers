const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: '❌ No token, authorization denied' });
    }

    // Check if it starts with Bearer
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({ message: '❌ No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: '❌ User not found' });
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({
        message: '🚫 Your account has been banned',
        reason: user.bannedReason || 'Violation of community guidelines',
        bannedAt: user.bannedAt
      });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: '❌ Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '❌ Token expired' });
    }
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return next();
    }
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.userId).select('-password');
    if (user) {
      req.user = user;
      req.userId = user._id;
    }
  } catch (error) {
    // Silently fail for optional auth
  }
  next();
};

module.exports = { auth, optionalAuth };

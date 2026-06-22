const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * @desc    Middleware to verify admin access
 * @usage   Must be used AFTER the regular auth middleware
 *          router.get('/admin/users', auth, adminAuth('admin'), controller)
 *
 * @param {string} requiredRole - Minimum role required: 'admin' or 'super_admin'
 */
const adminAuth = (requiredRole = 'admin') => {
  return async (req, res, next) => {
    try {
      // req.user should be set by the auth middleware
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: '🚫 Admin access required' });
      }

      // Role hierarchy: super_admin > admin
      // If requiredRole is 'super_admin', only super_admin can pass
      if (requiredRole === 'super_admin' && req.user.adminRole !== 'super_admin') {
        return res.status(403).json({ message: '🚫 Super admin access required' });
      }

      next();
    } catch (error) {
      console.error('Admin auth error:', error);
      res.status(500).json({ message: '❌ Server error', error: error.message });
    }
  };
};

module.exports = adminAuth;

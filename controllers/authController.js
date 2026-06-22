const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { username, email, password, gender, age, country } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: '❌ Please provide username, email and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: '❌ Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.email === email.toLowerCase() 
          ? '❌ Email already in use' 
          : '❌ Username already taken'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      gender: gender || 'male',
      age: age || 18,
      country: country || '',
      coins: 100 // Welcome bonus
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: '✅ User registered successfully',
      token,
      user: formatUser(user)
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: '❌ Please provide email and password' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: '❌ Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: '❌ Invalid credentials' });
    }

    // Update online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: '✅ Login successful',
      token,
      user: formatUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    res.json({
      user: formatUser(req.user)
    });
  } catch (error) {
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Update FCM token
// @route   PUT /api/auth/fcm-token
// @access  Private
exports.updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    req.user.fcmToken = fcmToken || '';
    await req.user.save();
    res.json({ message: '✅ FCM token updated' });
  } catch (error) {
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    req.user.isOnline = false;
    req.user.lastSeen = new Date();
    // Clear FCM token so device stops receiving notifications
    req.user.fcmToken = '';
    await req.user.save();
    res.json({ message: '✅ Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Change password (when logged in)
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '❌ Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: '❌ New password must be at least 6 characters' });
    }

    // Re-fetch user WITH password (auth middleware strips it via .select('-password'))
    const userWithPwd = await User.findById(req.userId).select('+password');
    if (!userWithPwd) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, userWithPwd.password);
    if (!isMatch) {
      return res.status(400).json({ message: '❌ Current password is incorrect' });
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(10);
    userWithPwd.password = await bcrypt.hash(newPassword, salt);
    await userWithPwd.save();

    res.json({ message: '✅ Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Delete own account
// @route   DELETE /api/auth/account
// @access  Private
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: '❌ Password required to delete account' });
    }

    // Re-fetch user WITH password (auth middleware strips it)
    const userWithPwd = await User.findById(req.userId).select('+password');
    if (!userWithPwd) {
      return res.status(404).json({ message: '❌ User not found' });
    }

    // Confirm password before destructive action
    const isMatch = await bcrypt.compare(password, userWithPwd.password);
    if (!isMatch) {
      return res.status(400).json({ message: '❌ Password is incorrect' });
    }

    const userId = req.user._id;

    // Delete user's messages
    const Message = require('../models/Message');
    await Message.deleteMany({ sender: userId });

    // Remove user from any rooms (and delete owned rooms)
    const Room = require('../models/Room');
    await Room.updateMany(
      { 'currentUsers.user': userId },
      { $pull: { currentUsers: { user: userId } } }
    );
    await Room.deleteMany({ owner: userId });

    // Remove user from agencies
    const Agency = require('../models/Agency');
    await Agency.updateMany(
      { 'members.user': userId },
      { $pull: { members: { user: userId } } }
    );

    // Clean up notifications (received + sent + referencing this user)
    const Notification = require('../models/Notification');
    await Notification.deleteMany({
      $or: [
        { recipient: userId },
        { sender: userId },
        { referenceId: userId, referenceType: 'user' }
      ]
    });

    await User.findByIdAndDelete(userId);

    res.json({ message: '✅ Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Forgot password - generate OTP reset code
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: '❌ Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // For privacy, always return success even if email doesn't exist
    // (prevents user enumeration)
    if (!user) {
      return res.json({ message: '✅ If the email exists, a reset code was sent' });
    }

    if (user.isBanned) {
      return res.json({ message: '✅ If the email exists, a reset code was sent' });
    }

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash code for storage (don't store plain)
    user.resetCode = await bcrypt.hash(resetCode, 10);
    user.resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // TODO: In production, send the code via email (Supabase / SMTP)
    // For now we return it in dev mode only (NEVER in production)
    const isDev = process.env.NODE_ENV !== 'production';
    res.json({
      message: '✅ Reset code generated. Check your email.',
      ...(isDev && { devResetCode: resetCode })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// @desc    Reset password with OTP code
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ message: '❌ Email, reset code and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: '❌ Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.resetCode || !user.resetCodeExpires) {
      return res.status(400).json({ message: '❌ Invalid or expired reset code' });
    }

    // Check expiry
    if (user.resetCodeExpires < new Date()) {
      user.resetCode = null;
      user.resetCodeExpires = null;
      await user.save();
      return res.status(400).json({ message: '❌ Reset code expired' });
    }

    // Verify code
    const isMatch = await bcrypt.compare(resetCode, user.resetCode);
    if (!isMatch) {
      return res.status(400).json({ message: '❌ Invalid reset code' });
    }

    // Update password and clear reset code
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetCode = null;
    user.resetCodeExpires = null;
    await user.save();

    res.json({ message: '✅ Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: '❌ Server error', error: error.message });
  }
};

// Helper functions
function generateToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '30d' }
  );
}

function formatUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    gender: user.gender,
    age: user.age,
    country: user.country,
    coins: user.coins,
    diamonds: user.diamonds,
    level: user.level,
    xp: user.xp,
    isVIP: user.isVIP,
    vipLevel: user.vipLevel,
    giftsReceived: user.giftsReceived,
    isOnline: user.isOnline,
    createdAt: user.createdAt
  };
}

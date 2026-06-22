/**
 * scripts/makeAdmin.js
 *
 * Usage:
 *   node scripts/makeAdmin.js <username_or_email> [role]
 *
 * Examples:
 *   node scripts/makeAdmin.js myuser           → sets isAdmin=true, adminRole='admin'
 *   node scripts/makeAdmin.js myuser super_admin → sets isAdmin=true, adminRole='super_admin'
 *   node scripts/makeAdmin.js myuser remove     → removes admin (isAdmin=false)
 *
 * Requires MONGO_URI in .env or environment
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found. Make sure .env file exists with MONGO_URI.');
  process.exit(1);
}

const [,, identifier, role = 'admin'] = process.argv;

if (!identifier) {
  console.error('❌ Usage: node scripts/makeAdmin.js <username_or_email> [role]');
  console.error('   Roles: admin, super_admin, remove');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }]
    });

    if (!user) {
      console.error(`❌ User "${identifier}" not found`);
      process.exit(1);
    }

    if (role === 'remove') {
      user.isAdmin = false;
      user.adminRole = 'admin';
      await user.save();
      console.log(`✅ Removed admin from: ${user.username} (${user.email})`);
    } else if (['admin', 'super_admin'].includes(role)) {
      user.isAdmin = true;
      user.adminRole = role;
      await user.save();
      console.log(`✅ Set admin role "${role}" for: ${user.username} (${user.email})`);
    } else {
      console.error('❌ Invalid role. Use: admin, super_admin, or remove');
      process.exit(1);
    }

    console.log(`   isAdmin: ${user.isAdmin}`);
    console.log(`   adminRole: ${user.adminRole}`);
    console.log(`   userId: ${user._id}`);

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

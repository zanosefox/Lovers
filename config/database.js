const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

/**
 * Read .env file directly and force-load values into process.env.
 * This protects against stale shell environment variables (e.g. an old
 * password exported in the shell) overriding the .env file.
 * dotenv.config() by default does NOT overwrite existing process.env keys.
 */
const loadEnvFile = () => {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const parsed = require('dotenv').parse(fs.readFileSync(envPath));
  // Force override — .env is the source of truth for this app
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }
};

loadEnvFile();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/lovers_app';

    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.log('⚠️ Running without MongoDB connection');
  }
};

module.exports = connectDB;

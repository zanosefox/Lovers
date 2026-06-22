/**
 * Gift seed data — default gifts available in the app.
 * Run with: node seeds/gifts.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/database');
const Gift = require('../models/Gift');

const defaultGifts = [
  // ❤️ Love Category
  { name: 'Rose', icon: '🌹', coinValue: 5, diamondValue: 0, rarity: 'common', category: 'love' },
  { name: 'Heart', icon: '❤️', coinValue: 10, diamondValue: 0, rarity: 'common', category: 'love' },
  { name: 'Red Rose Bouquet', icon: '💐', coinValue: 50, diamondValue: 0, rarity: 'rare', category: 'love' },
  { name: 'Love Letter', icon: '💌', coinValue: 30, diamondValue: 0, rarity: 'common', category: 'love' },
  { name: 'Wedding Ring', icon: '💍', coinValue: 500, diamondValue: 50, rarity: 'epic', category: 'love' },
  { name: 'Cupid Arrow', icon: '💘', coinValue: 100, diamondValue: 10, rarity: 'rare', category: 'love' },

  // 😂 Fun Category
  { name: 'Lollipop', icon: '🍭', coinValue: 1, diamondValue: 0, rarity: 'common', category: 'fun' },
  { name: 'Ice Cream', icon: '🍦', coinValue: 3, diamondValue: 0, rarity: 'common', category: 'fun' },
  { name: 'Cake', icon: '🎂', coinValue: 20, diamondValue: 0, rarity: 'common', category: 'fun' },
  { name: 'Party Popper', icon: '🎉', coinValue: 15, diamondValue: 0, rarity: 'common', category: 'fun' },
  { name: 'Confetti', icon: '🎊', coinValue: 25, diamondValue: 0, rarity: 'rare', category: 'fun' },
  { name: 'Fireworks', icon: '🎆', coinValue: 100, diamondValue: 10, rarity: 'rare', category: 'fun' },

  // 🎵 Music Category
  { name: 'Music Note', icon: '🎵', coinValue: 5, diamondValue: 0, rarity: 'common', category: 'music' },
  { name: 'Microphone', icon: '🎤', coinValue: 30, diamondValue: 0, rarity: 'common', category: 'music' },
  { name: 'Headphones', icon: '🎧', coinValue: 50, diamondValue: 0, rarity: 'rare', category: 'music' },
  { name: 'Guitar', icon: '🎸', coinValue: 200, diamondValue: 20, rarity: 'epic', category: 'music' },
  { name: 'Grand Piano', icon: '🎹', coinValue: 1000, diamondValue: 100, rarity: 'legendary', category: 'music' },

  // 👑 VIP Category
  { name: 'Star', icon: '⭐', coinValue: 10, diamondValue: 1, rarity: 'common', category: 'vip' },
  { name: 'Crown', icon: '👑', coinValue: 500, diamondValue: 50, rarity: 'epic', category: 'vip' },
  { name: 'Diamond', icon: '💎', coinValue: 1000, diamondValue: 100, rarity: 'legendary', category: 'vip' },
  { name: 'Golden Trophy', icon: '🏆', coinValue: 2000, diamondValue: 200, rarity: 'legendary', category: 'vip' },

  // 🎭 Special Category
  { name: 'Magic Wand', icon: '🪄', coinValue: 150, diamondValue: 15, rarity: 'rare', category: 'special' },
  { name: 'Rocket', icon: '🚀', coinValue: 300, diamondValue: 30, rarity: 'epic', category: 'special' },
  { name: 'Unicorn', icon: '🦄', coinValue: 500, diamondValue: 50, rarity: 'epic', category: 'special' },
  { name: 'Dragon', icon: '🐉', coinValue: 5000, diamondValue: 500, rarity: 'legendary', category: 'special' },
  { name: 'Castle', icon: '🏰', coinValue: 10000, diamondValue: 1000, rarity: 'legendary', category: 'special' }
];

const seedGifts = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding gifts...');

    // Clear existing gifts
    await Gift.deleteMany({});
    console.log(`   Cleared ${defaultGifts.length} old gifts`);

    // Insert new gifts
    const gifts = await Gift.insertMany(defaultGifts);
    console.log(`✅ Inserted ${gifts.length} gifts successfully!`);

    // Print summary
    console.log('\n📊 Summary by category:');
    const categories = {};
    gifts.forEach(g => {
      categories[g.category] = (categories[g.category] || 0) + 1;
    });
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} gifts`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seedGifts();

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Welcome to Lovers API! 💕',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health route
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Lovers API running on port ${PORT}`);
});

module.exports = app;

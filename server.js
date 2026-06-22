const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/database');
const errorHandler = require('./middleware/error');

// Pre-load all models so cross-model populate() works everywhere
require('./models/User');
require('./models/Room');
require('./models/Message');
require('./models/Gift');
require('./models/Agency');
require('./models/Post');
require('./models/Comment');
require('./models/Notification');

// Connect to MongoDB
connectDB();

// Initialize Firebase (FCM)
const { initFirebase } = require('./config/firebase');
initFirebase();

// Route files
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const giftRoutes = require('./routes/gifts');
const agencyRoutes = require('./routes/agencies');
const postRoutes = require('./routes/posts');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/gifts', giftRoutes);
app.use('/api/agencies', agencyRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Health check route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Welcome to Lovers API! 💕',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: !!process.env.MONGO_URI ? 'configured ✅' : 'not configured ⏳',
      supabase: !!process.env.SUPABASE_URL ? 'configured ✅' : 'not configured ⏳',
      cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME ? 'configured ✅' : 'not configured ⏳',
      firebase: !!process.env.FIREBASE_PROJECT_ID ? 'configured ✅' : 'not configured ⏳'
    }
  });
});

// Health route
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    connectedUsers: global.onlineUsers ? global.onlineUsers.size : 0,
    activeRooms: global.activeRooms ? global.activeRooms.size : 0
  });
});

// 404 handler (must be after routes)
app.use((req, res) => {
  res.status(404).json({ message: '❌ Route not found', path: req.originalUrl });
});

// Global error handler (must be last)
app.use(errorHandler);

// ============================================
// 🔌 SOCKET.IO SERVER (Real-time layer)
// ============================================
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Global state for tracking online users & active rooms
global.onlineUsers = new Map();   // userId -> { socketId, username, avatar }
global.activeRooms = new Map();   // roomId -> Set<userId>

// Register io instance in socket store (avoids circular dependency)
require('./config/socketStore').setIo(io);

// Wire up socket events
const socketHandler = require('./sockets');
io.on('connection', (socket) => socketHandler(io, socket));

// Start HTTP + Socket server
httpServer.listen(PORT, () => {
  console.log(`🚀 Lovers API running on port ${PORT}`);
  console.log(`🔌 Socket.IO server ready`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  httpServer.close(() => process.exit(1));
});

module.exports = { app, httpServer, io };

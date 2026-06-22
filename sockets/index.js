/**
 * Main socket connection handler.
 * Called for each new client connection.
 *
 * @param {Server} io - Socket.IO server instance
 * @param {Socket} socket - The new client socket
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');

module.exports = (io, socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // ============================================
  // 🔐 AUTH — client must send token to authenticate
  // ============================================
  socket.on('authenticate', async (data, callback) => {
    try {
      const token = data && (data.token || data);
      if (!token) {
        return callback({ success: false, message: '❌ No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId)
        .select('username avatar gender level isVIP isBanned country settings');

      if (!user) {
        return callback({ success: false, message: '❌ User not found' });
      }

      if (user.isBanned) {
        return callback({ success: false, message: '❌ You are banned' });
      }

      // Attach user info to socket
      socket.userId = user._id.toString();
      socket.user = {
        id: user._id.toString(),
        username: user.username,
        avatar: user.avatar,
        gender: user.gender,
        level: user.level,
        isVIP: user.isVIP,
        country: user.country
      };

      // Track online user globally
      global.onlineUsers.set(socket.userId, {
        socketId: socket.id,
        username: user.username,
        avatar: user.avatar
      });

      // Update DB: user is online
      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();

      // Broadcast to everyone that this user is online
      io.emit('user:online', { userId: socket.userId, user: socket.user });

      // Join personal notification room for targeted real-time notifications
      socket.join(`user:${socket.userId}`);

      // Send unread notification count
      try {
        const Notification = require('../models/Notification');
        const unreadCount = await Notification.countDocuments({
          recipient: socket.userId,
          isRead: false,
          isDeleted: false
        });
        socket.emit('notification:unread_count', { unreadCount });
      } catch (e) {}

      callback({
        success: true,
        message: '✅ Authenticated',
        user: socket.user
      });

      console.log(`✅ ${user.username} authenticated (${socket.id})`);
    } catch (error) {
      callback({ success: false, message: '❌ Invalid token' });
    }
  });

  // ============================================
  // 🏠 ROOM EVENTS
  // ============================================

  // Join a room (Socket room + DB tracking)
  socket.on('room:join', async (data, callback) => {
    try {
      if (!socket.userId) {
        return callback({ success: false, message: '❌ Not authenticated' });
      }

      const { roomId, password } = data || {};
      if (!roomId) {
        return callback({ success: false, message: '❌ roomId required' });
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return callback({ success: false, message: '❌ Room not found' });
      }

      if (!room.isLive) {
        return callback({ success: false, message: '❌ Room is not live' });
      }

      // Password check for private rooms
      if (room.type === 'private' && room.password && room.password !== password) {
        return callback({ success: false, message: '❌ Wrong room password' });
      }

      // Capacity check
      if (room.currentUsers.length >= room.maxUsers) {
        return callback({ success: false, message: '❌ Room is full' });
      }

      // Leave any previous room first
      if (socket.currentRoom) {
        await handleLeaveRoom(io, socket);
      }

      // Add user to room in DB (as listener by default, muted)
      const existingIndex = room.currentUsers.findIndex(
        u => u.user.toString() === socket.userId
      );

      if (existingIndex === -1) {
        room.currentUsers.push({
          user: socket.userId,
          role: 'listener',
          isMuted: true,
          isHandRaised: false,
          joinedAt: new Date()
        });
        room.totalVisits += 1;
      }

      await room.save();
      await room.populate('currentUsers.user', 'username avatar gender level isVIP');

      // Join socket room
      socket.join(roomId);
      socket.currentRoom = roomId;

      // Track in global active rooms
      if (!global.activeRooms.has(roomId)) {
        global.activeRooms.set(roomId, new Set());
      }
      global.activeRooms.get(roomId).add(socket.userId);

      // Get the user's room data
      const myRoomData = room.currentUsers.find(
        u => u.user._id.toString() === socket.userId
      );

      const roomState = {
        id: room._id,
        name: room.name,
        category: room.category,
        type: room.type,
        coverImage: room.coverImage,
        maxUsers: room.maxUsers,
        currentUsers: room.currentUsers.map(u => ({
          userId: u.user._id.toString(),
          username: u.user.username,
          avatar: u.user.avatar,
          gender: u.user.gender,
          level: u.user.level,
          isVIP: u.user.isVIP,
          role: u.role,
          isMuted: u.isMuted,
          isHandRaised: u.isHandRaised
        }))
      };

      // Notify others in room
      socket.to(roomId).emit('room:user_joined', {
        userId: socket.userId,
        user: socket.user
      });

      callback({
        success: true,
        room: roomState,
        myRole: myRoomData.role,
        myMuted: myRoomData.isMuted
      });

      console.log(`🏠 ${socket.user.username} joined room ${room.name}`);
    } catch (error) {
      console.error('room:join error:', error);
      callback({ success: false, message: '❌ Server error: ' + error.message });
    }
  });

  // Leave room
  socket.on('room:leave', async (data, callback) => {
    try {
      await handleLeaveRoom(io, socket);
      if (callback) callback({ success: true });
    } catch (error) {
      console.error('room:leave error:', error);
      if (callback) callback({ success: false, message: error.message });
    }
  });

  // ============================================
  // 🎤 VOICE / ROLE EVENTS
  // ============================================

  // Toggle mute
  socket.on('voice:mute', async (data, callback) => {
    try {
      if (!socket.userId || !socket.currentRoom) {
        return callback({ success: false, message: '❌ Not in a room' });
      }

      const room = await Room.findById(socket.currentRoom);
      if (!room) return callback({ success: false, message: '❌ Room not found' });

      const userInRoom = room.currentUsers.find(
        u => u.user.toString() === socket.userId
      );
      if (!userInRoom) return callback({ success: false, message: '❌ Not in room' });

      const newMuteState = data && typeof data.muted === 'boolean'
        ? data.muted
        : !userInRoom.isMuted;

      // Only speakers and above can unmute themselves
      if (!newMuteState && userInRoom.role === 'listener') {
        return callback({ success: false, message: '❌ Listeners must be promoted first' });
      }

      userInRoom.isMuted = newMuteState;
      await room.save();

      io.to(socket.currentRoom).emit('voice:mute_changed', {
        userId: socket.userId,
        isMuted: newMuteState
      });

      callback({ success: true, isMuted: newMuteState });
    } catch (error) {
      console.error('voice:mute error:', error);
      callback({ success: false, message: error.message });
    }
  });

  // Raise hand (listener wants to speak)
  socket.on('voice:raise_hand', async (data, callback) => {
    try {
      if (!socket.userId || !socket.currentRoom) {
        return callback({ success: false, message: '❌ Not in a room' });
      }

      const room = await Room.findById(socket.currentRoom);
      if (!room) return callback({ success: false, message: '❌ Room not found' });

      const userInRoom = room.currentUsers.find(
        u => u.user.toString() === socket.userId
      );
      if (!userInRoom) return callback({ success: false, message: '❌ Not in room' });

      const raised = data && typeof data.raised === 'boolean'
        ? data.raised
        : !userInRoom.isHandRaised;

      userInRoom.isHandRaised = raised;
      await room.save();

      io.to(socket.currentRoom).emit('voice:hand_raised', {
        userId: socket.userId,
        username: socket.user.username,
        isHandRaised: raised
      });

      callback({ success: true, isHandRaised: raised });
    } catch (error) {
      console.error('voice:raise_hand error:', error);
      callback({ success: false, message: error.message });
    }
  });

  // Owner/admin: promote listener to speaker
  socket.on('voice:promote', async (data, callback) => {
    try {
      if (!socket.userId || !socket.currentRoom) {
        return callback({ success: false, message: '❌ Not in a room' });
      }

      const { targetUserId } = data || {};
      const room = await Room.findById(socket.currentRoom);
      if (!room) return callback({ success: false, message: '❌ Room not found' });

      // Permission check: only owner/admin can promote
      const me = room.currentUsers.find(u => u.user.toString() === socket.userId);
      if (!me || (me.role !== 'owner' && me.role !== 'admin')) {
        return callback({ success: false, message: '❌ Not authorized' });
      }

      const target = room.currentUsers.find(
        u => u.user.toString() === targetUserId
      );
      if (!target) return callback({ success: false, message: '❌ User not in room' });

      target.role = 'speaker';
      target.isMuted = false;
      target.isHandRaised = false;
      await room.save();

      io.to(socket.currentRoom).emit('voice:role_changed', {
        userId: targetUserId,
        role: 'speaker',
        isMuted: false
      });

      callback({ success: true });
    } catch (error) {
      console.error('voice:promote error:', error);
      callback({ success: false, message: error.message });
    }
  });

  // Owner/admin: demote speaker back to listener
  socket.on('voice:demote', async (data, callback) => {
    try {
      if (!socket.userId || !socket.currentRoom) {
        return callback({ success: false, message: '❌ Not in a room' });
      }

      const { targetUserId } = data || {};
      const room = await Room.findById(socket.currentRoom);
      if (!room) return callback({ success: false, message: '❌ Room not found' });

      const me = room.currentUsers.find(u => u.user.toString() === socket.userId);
      if (!me || (me.role !== 'owner' && me.role !== 'admin')) {
        return callback({ success: false, message: '❌ Not authorized' });
      }

      const target = room.currentUsers.find(
        u => u.user.toString() === targetUserId
      );
      if (!target) return callback({ success: false, message: '❌ User not in room' });

      target.role = 'listener';
      target.isMuted = true;
      await room.save();

      io.to(socket.currentRoom).emit('voice:role_changed', {
        userId: targetUserId,
        role: 'listener',
        isMuted: true
      });

      callback({ success: true });
    } catch (error) {
      console.error('voice:demote error:', error);
      callback({ success: false, message: error.message });
    }
  });

  // ============================================
  // 💬 CHAT EVENTS
  // ============================================

  socket.on('chat:message', async (data, callback) => {
    try {
      if (!socket.userId || !socket.currentRoom) {
        return callback({ success: false, message: '❌ Not in a room' });
      }

      const { text } = data || {};
      if (!text || !text.trim()) {
        return callback({ success: false, message: '❌ Empty message' });
      }
      if (text.length > 500) {
        return callback({ success: false, message: '❌ Message too long (max 500)' });
      }

      // Save message to DB
      const message = await Message.create({
        room: socket.currentRoom,
        sender: socket.userId,
        text: text.trim(),
        type: 'text'
      });

      const msgPayload = {
        id: message._id,
        room: socket.currentRoom,
        sender: socket.user,
        text: text.trim(),
        type: 'text',
        createdAt: message.createdAt
      };

      // Broadcast to everyone in room (including sender for confirmation)
      io.to(socket.currentRoom).emit('chat:new_message', msgPayload);

      callback({ success: true, message: msgPayload });
    } catch (error) {
      console.error('chat:message error:', error);
      callback({ success: false, message: error.message });
    }
  });

  // Typing indicator
  socket.on('chat:typing', (data) => {
    if (!socket.userId || !socket.currentRoom) return;
    socket.to(socket.currentRoom).emit('chat:user_typing', {
      userId: socket.userId,
      username: socket.user.username,
      isTyping: data && data.isTyping
    });
  });

  // ============================================
  // 🔊 WEBRTC SIGNALING (for voice/video)
  // ============================================

  // Relay WebRTC offer/answer/candidates between peers
  socket.on('signal:offer', (data) => {
    if (!socket.currentRoom) return;
    socket.to(socket.currentRoom).emit('signal:offer', {
      from: socket.userId,
      signal: data.signal
    });
  });

  socket.on('signal:answer', (data) => {
    if (!socket.currentRoom) return;
    socket.to(socket.currentRoom).emit('signal:answer', {
      from: socket.userId,
      signal: data.signal
    });
  });

  socket.on('signal:candidate', (data) => {
    if (!socket.currentRoom) return;
    socket.to(socket.currentRoom).emit('signal:candidate', {
      from: socket.userId,
      candidate: data.candidate
    });
  });

  // ============================================
  // 🟢 PRESENCE
  // ============================================

  socket.on('presence:get_online', (data, callback) => {
    const onlineList = Array.from(global.onlineUsers.entries()).map(([userId, info]) => ({
      userId,
      username: info.username,
      avatar: info.avatar
    }));
    callback({ success: true, users: onlineList, count: onlineList.length });
  });

  // ============================================
  // 🔌 DISCONNECT
  // ============================================
  socket.on('disconnect', async () => {
    console.log(`🔌 Disconnected: ${socket.id}`);

    if (socket.userId) {
      // Leave personal notification room
      socket.leave(`user:${socket.userId}`);

      // Leave any room
      if (socket.currentRoom) {
        await handleLeaveRoom(io, socket);
      }

      // Remove from online users
      global.onlineUsers.delete(socket.userId);

      // Mark offline in DB
      try {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date()
        });
      } catch (e) {}

      // Broadcast offline status
      io.emit('user:offline', { userId: socket.userId });
    }
  });
};

// ============================================
// 🛠️ HELPER: handle leaving a room
// ============================================
async function handleLeaveRoom(io, socket) {
  if (!socket.currentRoom) return;

  const roomId = socket.currentRoom;
  socket.leave(roomId);

  // Remove from global active rooms
  if (global.activeRooms.has(roomId)) {
    global.activeRooms.get(roomId).delete(socket.userId);
    if (global.activeRooms.get(roomId).size === 0) {
      global.activeRooms.delete(roomId);
    }
  }

  // Remove from DB room
  try {
    const room = await Room.findById(roomId);
    if (room) {
      room.currentUsers = room.currentUsers.filter(
        u => u.user.toString() !== socket.userId
      );

      // If owner leaves and room is empty, mark not live
      if (room.currentUsers.length === 0) {
        room.isLive = false;
      }

      await room.save();
    }
  } catch (e) {
    console.error('handleLeaveRoom DB error:', e);
  }

  // Notify others
  io.to(roomId).emit('room:user_left', {
    userId: socket.userId,
    username: socket.user ? socket.user.username : 'Unknown'
  });

  socket.currentRoom = null;
}

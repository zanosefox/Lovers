// ============================================
// 🔌 Socket.IO Instance Store
// ============================================
// Central holder for the io instance to avoid circular
// dependency between server.js and notificationController.js
//
// server.js calls setIo(io) once the server is created,
// and notificationController calls getIo() when emitting.

let ioInstance = null;

/**
 * Store the Socket.IO server instance (called from server.js)
 * @param {import('socket.io').Server} io
 */
const setIo = (io) => {
  ioInstance = io;
};

/**
 * Get the Socket.IO server instance (safe — returns null if not ready)
 * @returns {import('socket.io').Server | null}
 */
const getIo = () => ioInstance;

module.exports = { setIo, getIo };

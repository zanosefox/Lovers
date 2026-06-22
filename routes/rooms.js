const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { auth } = require('../middleware/auth');

// @route   GET /api/rooms
router.get('/', roomController.getRooms);

// @route   GET /api/rooms/my/rooms
router.get('/my/rooms', auth, roomController.getMyRooms);

// @route   GET /api/rooms/:id
router.get('/:id', roomController.getRoom);

// @route   POST /api/rooms
router.post('/', auth, roomController.createRoom);

// @route   POST /api/rooms/:id/join
router.post('/:id/join', auth, roomController.joinRoom);

// @route   POST /api/rooms/:id/leave
router.post('/:id/leave', auth, roomController.leaveRoom);

// @route   POST /api/rooms/:id/invite
router.post('/:id/invite', auth, roomController.inviteToRoom);

// @route   PUT /api/rooms/:id
router.put('/:id', auth, roomController.updateRoom);

// @route   DELETE /api/rooms/:id
router.delete('/:id', auth, roomController.deleteRoom);

module.exports = router;

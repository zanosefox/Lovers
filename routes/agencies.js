const express = require('express');
const router = express.Router();
const agencyController = require('../controllers/agencyController');
const { auth } = require('../middleware/auth');

// @route   GET /api/agencies
router.get('/', agencyController.getAllAgencies);

// @route   POST /api/agencies
router.post('/', auth, agencyController.createAgency);

// @route   GET /api/agencies/:id
router.get('/:id', agencyController.getAgency);

// @route   POST /api/agencies/:id/join
router.post('/:id/join', auth, agencyController.joinAgency);

// @route   POST /api/agencies/leave
router.post('/leave', auth, agencyController.leaveAgency);

// @route   PUT /api/agencies/:id
router.put('/:id', auth, agencyController.updateAgency);

// @route   DELETE /api/agencies/:id
router.delete('/:id', auth, agencyController.deleteAgency);

module.exports = router;

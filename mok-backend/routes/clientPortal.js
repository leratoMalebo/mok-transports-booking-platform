// =============================================================
// mok-backend/routes/Clients.js
// =============================================================

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/Clientcontroller');

// GET /api/client/:userId/waybills
router.get('/:userId/waybills', controller.getClientWaybills);

// GET /api/client/:userId/stats
router.get('/:userId/stats', controller.getClientStats);

// GET /api/client/:userId/truck-bookings
router.get('/:userId/truck-bookings', controller.getClientTruckBookings);

module.exports = router;




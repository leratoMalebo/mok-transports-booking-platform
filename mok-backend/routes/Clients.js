// =============================================================
// mok-backend/routes/clients.js
// =============================================================

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/clientController');

// GET /api/client/:userId/waybills
router.get('/:userId/waybills', controller.getClientWaybills);

// GET /api/client/:userId/stats
router.get('/:userId/stats', controller.getClientStats);

module.exports = router;


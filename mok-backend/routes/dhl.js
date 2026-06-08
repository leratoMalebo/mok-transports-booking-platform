// mok-backend/routes/dhl.js
const express = require('express');
const router = express.Router();
// Renamed this to dhlController to make the rest of the file safer and more descriptive
const dhlController = require('../controllers/dhlController');

// ── Specific routes FIRST (before param routes) ──────────────
// GET  /api/dhl/shipments          — list all DHL shipments
router.get('/shipments', dhlController.getShipments);

// POST /api/dhl/shipments          — create new DHL shipment
router.post('/shipments', dhlController.createShipment);

// POST /api/dhl/rates              — get rate estimate
router.post('/rates', dhlController.getRates);

router.post('/address-validate', dhlController.validateAddress);
    
// GET  /api/dhl/track/:trackingNo  — live tracking from DHL API
router.get('/track/:trackingNo', dhlController.trackShipment);

// ── Param routes LAST ─────────────────────────────────────────
// GET  /api/dhl/shipments/:trackingNo/label  — download PDF label
router.get('/shipments/:trackingNo/label', dhlController.getLabel);

// GET  /api/dhl/shipments/:trackingNo        — single shipment from DB
router.get('/shipments/:trackingNo', dhlController.getShipmentByTracking);

module.exports = router;


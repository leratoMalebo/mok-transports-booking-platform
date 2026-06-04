// mok-backend/routes/dhl.js
const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/dhlController');

// ── Specific routes FIRST (before param routes) ──────────────
// GET  /api/dhl/shipments          — list all DHL shipments
router.get('/shipments',                      controller.getShipments);

// POST /api/dhl/shipments          — create new DHL shipment
router.post('/shipments',                     controller.createShipment);

// POST /api/dhl/rates              — get rate estimate
router.post('/rates',                         controller.getRates);

// GET  /api/dhl/track/:trackingNo  — live tracking from DHL API
router.get('/track/:trackingNo',              controller.trackShipment);

// ── Param routes LAST ─────────────────────────────────────────
// GET  /api/dhl/shipments/:trackingNo        — single shipment from DB
router.get('/shipments/:trackingNo',          controller.getShipmentByTracking);

// GET  /api/dhl/shipments/:trackingNo/label  — download PDF label
router.get('/shipments/:trackingNo/label',    controller.getLabel);

module.exports = router;
// mok-backend/routes/dhl.js
const express       = require('express');
const router        = express.Router();
const dhlController = require('../controllers/dhlController');

// ── Collection routes (no params) — MUST come first ──────────

// GET  /api/dhl/shipments        — all shipments (staff) or filtered by ?client_id=X (client)
router.get('/shipments',                              dhlController.getShipments);

// POST /api/dhl/shipments        — create new DHL shipment
router.post('/shipments',                             dhlController.createShipment);

// POST /api/dhl/rates            — rate estimate
router.post('/rates',                                 dhlController.getRates);

// POST /api/dhl/address-validate — validate delivery address
router.post('/address-validate',                      dhlController.validateAddress);

// POST /api/dhl/validate-address — alternate URL (same handler)
router.post('/validate-address',                      dhlController.validateAddress);

// GET  /api/dhl/track/:trackingNo — live tracking from DHL API
router.get('/track/:trackingNo',                      dhlController.trackShipment);

// ── Param routes LAST — specific sub-paths before bare param ──

// GET  /api/dhl/shipments/:trackingNo/label          — PDF label download
router.get('/shipments/:trackingNo/label',            dhlController.getLabel);

// GET  /api/dhl/shipments/:trackingNumber/download-label — alternate label download
router.get('/shipments/:trackingNumber/download-label', dhlController.downloadLabel);

// GET  /api/dhl/shipments/:trackingNo — single shipment from DB (bare param LAST)
router.get('/shipments/:trackingNo',                  dhlController.getShipmentByTracking);

module.exports = router;



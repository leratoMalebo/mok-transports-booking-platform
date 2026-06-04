// =============================================================
// mok-backend/controllers/dhlController.js
// =============================================================

const db = require('../db');
const dhlService = require('../services/dhlService');

// ── POST /api/dhl/shipments ───────────────────────────────────
// Receives the DHL payload from imports.html, submits to DHL,
// saves the result to the database
exports.createShipment = async (req, res) => {
    try {
        const { payload, mode } = req.body;

        if (!payload) {
            return res.status(400).json({ error: 'DHL payload is required.' });
        }

        // Submit to DHL

        console.log(
            '[DHL PAYLOAD]',
            JSON.stringify(payload, null, 2)
        );
        const dhlResult = await dhlService.createShipment(payload);

        const trackingNo = dhlResult.shipmentTrackingNumber;
        console.log('✅ DHL Tracking Number:', trackingNo);

        const documents = dhlResult.documents || [];
        const labelB64 = documents.find(d => d.typeCode === 'label')?.content || null;

        // Save to DB — store full DHL response for label printing later
        const saved = await db.query(`
      INSERT INTO dhl_shipments (
        tracking_number,
        mode,
        product_code,
        shipper_name,
        shipper_country,
        receiver_name,
        receiver_country,
        weight,
        declared_value,
        declared_currency,
        ship_date,
        dhl_response,
        label_pdf_b64,
        created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      RETURNING *
    `, [
            trackingNo,
            payload.shipmentDirection || 'EXPORT',
            payload.productCode,
            payload.customerDetails?.shipperDetails?.contactInformation?.companyName || '',
            payload.customerDetails?.shipperDetails?.postalAddress?.countryCode || '',
            payload.customerDetails?.receiverDetails?.contactInformation?.companyName || '',
            payload.customerDetails?.receiverDetails?.postalAddress?.countryCode || '',
            payload.content?.packages?.[0]?.weight || 0,
            payload.content?.declaredValue || null,
            payload.content?.declaredValueCurrency || null,
            payload.plannedShippingDateAndTime?.split('T')[0] || new Date().toISOString().split('T')[0],
            JSON.stringify(dhlResult),
            labelB64
        ]);

        res.status(201).json({
            message: 'DHL shipment created successfully.',
            shipmentTrackingNumber: trackingNo,
            documents,
            dbRecord: saved.rows[0]
        });

    } catch (err) {
        console.error('DHL CREATE SHIPMENT ERROR:', err.message);
        res.status(500).json({ error: err.message || 'Failed to create DHL shipment.' });
    }
};

// ── GET /api/dhl/shipments ────────────────────────────────────
exports.getShipments = async (req, res) => {
    try {
        const result = await db.query(`
      SELECT id, tracking_number, mode, product_code,
             shipper_name, shipper_country,
             receiver_name, receiver_country,
             weight, declared_value, declared_currency,
             ship_date, created_at,
             (dhl_response->>'shipmentTrackingNumber') AS dhl_tracking
      FROM dhl_shipments
      ORDER BY created_at DESC
    `);
        res.json(result.rows);
    } catch (err) {
        console.error('GET DHL SHIPMENTS ERROR:', err.message);
        res.status(500).json({ error: 'Failed to fetch DHL shipments.' });
    }
};

// ── GET /api/dhl/shipments/:trackingNo ───────────────────────
exports.getShipmentByTracking = async (req, res) => {
    try {
        const { trackingNo } = req.params;
        const result = await db.query(
            `SELECT * FROM dhl_shipments WHERE tracking_number = $1`,
            [trackingNo]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: `DHL shipment ${trackingNo} not found.` });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('GET DHL SHIPMENT ERROR:', err.message);
        res.status(500).json({ error: 'Failed to fetch shipment.' });
    }
};

// ── GET /api/dhl/track/:trackingNo ───────────────────────────
// Fetches live tracking from DHL API
exports.trackShipment = async (req, res) => {
    try {
        const { trackingNo } = req.params;
        const result = await dhlService.trackShipment(trackingNo);
        res.json(result);
    } catch (err) {
        console.error('DHL TRACK ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── POST /api/dhl/rates ───────────────────────────────────────
// Get rate estimate before booking
exports.getRates = async (req, res) => {
    try {
        const { payload } = req.body;
        const result = await dhlService.getRates(payload);
        res.json(result);
    } catch (err) {
        console.error('DHL RATES ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.validateAddress = async (req, res) => {
    try {

        const result =
            await dhlService.validateAddress(req.body);

        res.json(result);

    } catch (err) {

        console.error(
            'DHL ADDRESS VALIDATION ERROR:',
            err.message
        );

        res.status(500).json({
            error: err.message
        });

    }
};

// ── GET /api/dhl/shipments/:trackingNo/label ─────────────────
// Returns the base64 PDF label stored at time of creation
exports.getLabel = async (req, res) => {
    try {
        const { trackingNo } = req.params;
        const result = await db.query(
            `SELECT label_pdf_b64 FROM dhl_shipments WHERE tracking_number = $1`,
            [trackingNo]
        );
        if (!result.rows.length || !result.rows[0].label_pdf_b64) {
            return res.status(404).json({ error: 'Label not found.' });
        }
        const pdf = Buffer.from(result.rows[0].label_pdf_b64, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="DHL_Label_${trackingNo}.pdf"`);
        res.send(pdf);
    } catch (err) {
        console.error('GET LABEL ERROR:', err.message);
        res.status(500).json({ error: 'Failed to retrieve label.' });
    }
};



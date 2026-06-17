// =============================================================
// mok-backend/controllers/dhlController.js
// MERGED — combines your latest version + client_id upgrades
// =============================================================

const db         = require('../db');
const dhlService = require('../services/dhlService');

// ── POST /api/dhl/shipments ───────────────────────────────────
exports.createShipment = async (req, res) => {
  try {
    const { payload, mode, client_id, client_name, client_company } = req.body;

    if (!payload) {
      return res.status(400).json({ error: 'DHL payload is required.' });
    }

    // Log full payload for debugging (from your version)
    console.log('[DHL PAYLOAD]', JSON.stringify(payload, null, 2));

    // Use mode from request body, fall back to payload direction, then 'export'
    const shipmentMode = mode || payload.shipmentDirection || 'export';

    const dhlResult  = await dhlService.createShipment(payload);
    const trackingNo = dhlResult.shipmentTrackingNumber;
    console.log('✅ DHL Tracking Number:', trackingNo);

    const documents = dhlResult.documents || [];
    const labelB64  = documents.find(d => d.typeCode === 'label')?.content || null;

    // Save to DB — includes client identity columns so staff can see who submitted
    const saved = await db.query(`
      INSERT INTO dhl_shipments (
        tracking_number, mode, product_code,
        shipper_name, shipper_country,
        receiver_name, receiver_country,
        weight, declared_value, declared_currency,
        ship_date, dhl_response, label_pdf_b64,
        client_id, client_name, client_company,
        created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
      RETURNING *
    `, [
      trackingNo,
      shipmentMode,
      payload.productCode,
      payload.customerDetails?.shipperDetails?.contactInformation?.companyName  || '',
      payload.customerDetails?.shipperDetails?.postalAddress?.countryCode       || '',
      payload.customerDetails?.receiverDetails?.contactInformation?.companyName || '',
      payload.customerDetails?.receiverDetails?.postalAddress?.countryCode      || '',
      payload.content?.packages?.[0]?.weight || 0,
      payload.content?.declaredValue         || null,
      payload.content?.declaredValueCurrency || null,
      payload.plannedShippingDateAndTime?.split('T')[0] || new Date().toISOString().split('T')[0],
      JSON.stringify(dhlResult),
      labelB64,
      client_id      || null,
      client_name    || null,
      client_company || null
    ]);

    res.status(201).json({
      message:                'DHL shipment created successfully.',
      shipmentTrackingNumber: trackingNo,
      documents,
      dbRecord:               saved.rows[0]
    });

  } catch (err) {
    console.error('DHL CREATE SHIPMENT ERROR:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create DHL shipment.' });
  }
};

// ── GET /api/dhl/shipments ────────────────────────────────────
// Staff: returns all shipments (no query param)
// Client: pass ?client_id=X to filter to their own shipments only
exports.getShipments = async (req, res) => {
  try {
    const { client_id } = req.query;

    let query = `
      SELECT id, tracking_number, mode, product_code,
             shipper_name, shipper_country,
             receiver_name, receiver_country,
             weight, declared_value, declared_currency,
             ship_date, created_at,
             client_id, client_name, client_company,
             (dhl_response->>'shipmentTrackingNumber') AS dhl_tracking
      FROM dhl_shipments
    `;
    const params = [];

    if (client_id) {
      query += ' WHERE client_id = $1';
      params.push(client_id);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
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

// ── POST /api/dhl/validate-address ───────────────────────────
// From your version — validates a delivery address with DHL
exports.validateAddress = async (req, res) => {
  try {
    const result = await dhlService.validateAddress(req.body);
    res.json(result);
  } catch (err) {
    console.error('DHL ADDRESS VALIDATION ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/dhl/shipments/:trackingNo/label ─────────────────
// Returns base64 PDF label stored at time of creation
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

// ── GET /api/dhl/shipments/:trackingNumber/download-label ─────
// From your version — fixed: was using 'pool' (undefined), now uses 'db'
exports.downloadLabel = async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    const result = await db.query(
      `SELECT label_pdf_b64 FROM dhl_shipments WHERE tracking_number = $1`,
      [trackingNumber]
    );
    if (!result.rows.length || !result.rows[0].label_pdf_b64) {
      return res.status(404).json({ error: 'Label not found.' });
    }
    const pdfBuffer = Buffer.from(result.rows[0].label_pdf_b64, 'base64');
    res.setHeader('Content-Disposition', `attachment; filename="DHL-${trackingNumber}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('DOWNLOAD LABEL ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};



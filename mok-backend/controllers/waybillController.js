const db = require('../db');

const jkjService = require('../services/jkjService');

async function generateWaybillNumber() {
  const result = await db.query(`
    SELECT nextval('waybill_no_seq') AS next_no
  `);

  const nextNo = Number(result.rows[0].next_no);

  return `MOK${String(nextNo).padStart(6, '0')}`;
}


// CREATE WAYBILL
exports.createWaybill = async (req, res) => {
  try {
    const {
      booking_id,
      weight,
      volumetric_weight,
      length,
      width,
      height,
      items
    } = req.body;

    const waybill_no = await generateWaybillNumber();

    const result = await db.query(
      `INSERT INTO waybills 
      (booking_id, waybill_no, weight, volumetric_weight, length, width, height, items)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        booking_id, waybill_no, weight, volumetric_weight,
        length || null, width || null, height || null,
        items && items.length ? JSON.stringify(items) : null
      ]
    );

    const waybill = result.rows[0];

    // Respond immediately — client never waits for email
    res.json(waybill);

    // ── Fire notification email non-blocking ────────────────────
    try {
      const bookingResult = await db.query(
        'SELECT * FROM bookings WHERE id = $1', [booking_id]
      );
      if (bookingResult.rows.length) {
        const emailService = require('../services/emailService');
        await emailService.sendBookingNotification({
          booking: bookingResult.rows[0],
          waybill
        });
      }
    } catch (emailErr) {
      console.error('Email notification error:', emailErr.message);
    }

  } catch (err) {
    console.error('CREATE WAYBILL ERROR:', err.message);
    res.status(500).json({ error: 'Failed to create waybill' });
  }
};


// GET ALL WAYBILLS
exports.getWaybills = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        w.*,
        b.service,
        b.consignor_name,
        b.consignee_name,
        b.price
      FROM waybills w
      LEFT JOIN bookings b ON b.id = w.booking_id
      ORDER BY w.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('GET WAYBILLS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch waybills' });
  }
};

// SEND WAYBILL TO JKJ
exports.sendToJKJ = async (req, res) => {
  try {
    const { waybillNo } = req.params;

    const check = await db.query(
      `SELECT 
        w.*,
        b.service,
        b.consignor_name,
        b.consignor_address,
       b.consignor_contact,
b.consignor_contact_name,
b.consignor_suburb,
b.consignor_town,
b.consignee_name,
b.consignee_address,
b.consignee_contact,
b.consignee_contact_name,
b.consignee_suburb,
b.consignee_town,
        b.price
      FROM waybills w
      LEFT JOIN bookings b ON b.id = w.booking_id
      WHERE w.waybill_no = $1`,
      [waybillNo]
    );

    if (!check.rows.length) {
      return res.status(404).json({ error: 'Waybill not found' });
    }

    const waybill = check.rows[0];

    if (waybill.sent_to_jkj === true) {
      return res.status(400).json({ error: 'Waybill already sent to JKJ' });
    }

    const jkjResult = await jkjService.submitWaybillToJKJ(waybill);

    const jkjReference =
      jkjResult?.results?.[0]?.waybillno ||
      jkjResult?.results?.[0]?.histid ||
      null;

    const updated = await db.query(
      `UPDATE waybills
   SET sent_to_jkj = true,
       status = 'sent_to_jkj',
       jkj_reference = $1,
       jkj_response = $2
   WHERE waybill_no = $3
   RETURNING *`,
      [
        jkjReference,
        JSON.stringify(jkjResult),
        waybillNo
      ]
    );

    res.json({
      message: 'Waybill sent to JKJ successfully',
      jkjResponse: jkjResult,
      waybill: updated.rows[0]
    });

  } catch (err) {
    console.error('SEND TO JKJ ERROR:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to send waybill to JKJ' });
  }
};

// SEARCH WAYBILLS
exports.searchWaybills = async (req, res) => {
  try {
    const q = req.query.q || '';

    const result = await db.query(
      `
      SELECT 
        w.*,
        b.service,
        b.consignor_name,
        b.consignee_name,
        b.price
      FROM waybills w
      LEFT JOIN bookings b ON b.id = w.booking_id
      WHERE 
        w.waybill_no ILIKE $1
        OR w.status ILIKE $1
        OR b.service ILIKE $1
        OR b.consignor_name ILIKE $1
        OR b.consignee_name ILIKE $1
      ORDER BY w.created_at DESC
      `,
      [`%${q}%`]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('SEARCH WAYBILLS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to search waybills' });
  }
};


// GET SINGLE WAYBILL BY WAYBILL NUMBER
exports.getWaybillByNumber = async (req, res) => {
  try {
    const { waybillNo } = req.params;

    const result = await db.query(
      `SELECT 
        w.*,
        b.booking_date,
        b.service,
        b.consignor_name,
        b.consignor_address,
       b.consignor_contact,
b.consignor_contact,
b.consignor_contact_name,
b.consignor_suburb,
b.consignor_town,
b.consignee_name,
b.consignee_address,
b.consignee_contact,
b.consignee_contact_name,
b.consignee_suburb,
b.consignee_town,
        b.price,
        b.zone_label
       FROM waybills w
       LEFT JOIN bookings b ON b.id = w.booking_id
       WHERE w.waybill_no = $1`,
      [waybillNo]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Waybill not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('GET WAYBILL ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch waybill' });
  }
};

// ─────────────────────────────────────────────
// SAVE DISPATCH RE-WEIGH
// PATCH /api/waybills/:waybillNo/reweigh
// Body: { actual_weight, actual_length, actual_width, actual_height, reweighed_by }
// Recorded by dispatch/warehouse staff when they physically re-weigh and
// re-measure a parcel at pickup/collection — the declared weight and
// dimensions on the waybill are whatever the client typed in at booking
// time, and are often wrong (under- or over-stated).
//
// Volumetric weight is recalculated server-side using JKJ's own
// published formula (L × W × H ÷ 5000 — confirmed against jkjexpress.co.za
// and matches existing sample waybills), never trusted from the client,
// so it can't be tampered with or drift out of sync with the real one.
//
// has_discrepancy flags when the actual billable weight (the greater of
// actual weight vs. recalculated volumetric weight) differs meaningfully
// from what was declared at booking — this is what should trigger a
// rebilling conversation with accounts, not just a shrug.
// ─────────────────────────────────────────────
const JKJ_VOLUMETRIC_DIVISOR = 5000;
const DISCREPANCY_TOLERANCE_KG = 0.5;

exports.saveReweigh = async (req, res) => {
  try {
    const { waybillNo } = req.params;
    const { actual_weight, actual_length, actual_width, actual_height, reweighed_by } = req.body;

    const weight = Number(actual_weight);
    const length = Number(actual_length);
    const width  = Number(actual_width);
    const height = Number(actual_height);

    if ([weight, length, width, height].some(n => !Number.isFinite(n) || n <= 0)) {
      return res.status(400).json({ error: 'Actual weight, length, width and height must all be positive numbers.' });
    }

    const actualVolumetricWeight = Math.round(((length * width * height) / JKJ_VOLUMETRIC_DIVISOR) * 100) / 100;
    const actualBillableWeight   = Math.max(weight, actualVolumetricWeight);

    const existing = await db.query(
      `SELECT weight, volumetric_weight FROM waybills WHERE waybill_no = $1`, [waybillNo]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Waybill not found' });
    }
    const declaredWeight     = Number(existing.rows[0].weight || 0);
    const declaredVolumetric = Number(existing.rows[0].volumetric_weight || 0);
    const declaredBillableWeight = Math.max(declaredWeight, declaredVolumetric);
    const hasDiscrepancy = Math.abs(actualBillableWeight - declaredBillableWeight) > DISCREPANCY_TOLERANCE_KG;

    const result = await db.query(`
      UPDATE waybills SET
        actual_weight = $1,
        actual_length = $2,
        actual_width = $3,
        actual_height = $4,
        actual_volumetric_weight = $5,
        reweighed_by = $6,
        reweighed_at = NOW(),
        has_discrepancy = $7
      WHERE waybill_no = $8
      RETURNING *`,
      [weight, length, width, height, actualVolumetricWeight,
       (reweighed_by || '').trim() || null, hasDiscrepancy, waybillNo]
    );

    res.json({
      ...result.rows[0],
      actual_billable_weight: actualBillableWeight,
      declared_billable_weight: declaredBillableWeight
    });
  } catch (err) {
    console.error('SAVE REWEIGH ERROR:', err.message);
    res.status(500).json({ error: 'Failed to save re-weigh details' });
  }
};




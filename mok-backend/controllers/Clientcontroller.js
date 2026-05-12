// =============================================================
// mok-backend/controllers/clientController.js
// Client-facing data endpoints — waybills, shipment stats
// =============================================================
const db = require('../db');

// ---------------------------------------------------------------
// GET /api/client/:userId/waybills
// Returns all waybills linked to bookings made by this client
// ---------------------------------------------------------------
exports.getClientWaybills = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, search } = req.query;

    let query = `
      SELECT
        w.id,
        w.waybill_no,
        w.weight,
        w.volumetric_weight,
        w.status,
        w.sent_to_jkj,
        w.jkj_reference,
        w.created_at,
        b.service,
        b.consignor_name,
        b.consignor_address,
        b.consignee_name,
        b.consignee_address,
        b.booking_date,
        b.price,
        b.zone_label
      FROM waybills w
      LEFT JOIN bookings b ON b.id = w.booking_id
      WHERE b.user_id = $1
    `;

    const params = [userId];
    let paramIdx = 2;

    if (status && status !== 'all') {
      query += ` AND LOWER(w.status) = LOWER($${paramIdx})`;
      params.push(status);
      paramIdx++;
    }

    if (search) {
      query += ` AND (
        w.waybill_no     ILIKE $${paramIdx} OR
        b.consignee_name ILIKE $${paramIdx} OR
        b.consignor_name ILIKE $${paramIdx} OR
        b.service        ILIKE $${paramIdx}
      )`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    query += ' ORDER BY w.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);

  } catch (err) {
    console.error('CLIENT WAYBILLS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch your shipments.' });
  }
};

// ---------------------------------------------------------------
// GET /api/client/:userId/stats
// Summary stats for the client dashboard header chips
// ---------------------------------------------------------------
exports.getClientStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE LOWER(w.status) = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE LOWER(w.status) IN ('booked','sent_to_jkj','in_transit')) AS in_transit
      FROM waybills w
      LEFT JOIN bookings b ON b.id = w.booking_id
      WHERE b.user_id = $1
    `, [userId]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('CLIENT STATS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
};




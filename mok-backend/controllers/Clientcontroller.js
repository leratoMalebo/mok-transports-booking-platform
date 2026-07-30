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
        b.consignor_contact,
       
        b.consignor_town,
        b.consignee_name,
        b.consignee_address,
        b.consignee_contact,
       
        b.consignee_town,
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
// Combines local courier waybills AND truck bookings, since a
// client's "shipments" span both services.
// ---------------------------------------------------------------
exports.getClientStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const waybillStats = await db.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE LOWER(w.status) = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE LOWER(w.status) IN ('booked','sent_to_jkj','in_transit')) AS in_transit
      FROM waybills w
      LEFT JOIN bookings b ON b.id = w.booking_id
      WHERE b.user_id = $1
    `, [userId]);

    // Truck bookings aren't linked by user_id — they're matched by the
    // client's email address, same as the users table records it.
    const userResult = await db.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    const email = userResult.rows[0]?.email || null;

    let truckStats = { total: 0, delivered: 0, in_transit: 0 };
    if (email) {
      const tRes = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status != 'quote')                AS total,
          COUNT(*) FILTER (WHERE status = 'delivered')              AS delivered,
          COUNT(*) FILTER (WHERE status IN ('confirmed','in_transit')) AS in_transit
        FROM truck_bookings
        WHERE LOWER(client_email) = LOWER($1)
      `, [email]);
      truckStats = tRes.rows[0];
    }

    const w = waybillStats.rows[0];
    res.json({
      total:      Number(w.total)      + Number(truckStats.total),
      delivered:  Number(w.delivered)  + Number(truckStats.delivered),
      in_transit: Number(w.in_transit) + Number(truckStats.in_transit)
    });
  } catch (err) {
    console.error('CLIENT STATS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
};

// ---------------------------------------------------------------
// GET /api/client/:userId/truck-bookings
// Returns only this client's truck bookings — matched server-side
// by email, so their browser never receives other clients' data.
// ---------------------------------------------------------------
exports.getClientTruckBookings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    const userResult = await db.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    const email = userResult.rows[0]?.email;
    if (!email) return res.json([]);

    let query = `SELECT * FROM truck_bookings WHERE LOWER(client_email) = LOWER($1)`;
    const params = [email];

    if (status && status !== 'all') {
      query += ` AND status = $2`;
      params.push(status);
    } else {
      // By default, exclude unconfirmed quotes — this endpoint is for
      // tracking actual shipments, not previewing draft quotations.
      query += ` AND status != 'quote'`;
    }
    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('CLIENT TRUCK BOOKINGS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch your truck bookings.' });
  }
};


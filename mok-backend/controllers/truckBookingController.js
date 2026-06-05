const db = require('../db');

// ─────────────────────────────────────────────
// CREATE TRUCK BOOKING
// POST /api/truck-bookings
// ─────────────────────────────────────────────
exports.createBooking = async (req, res) => {
  try {
    const {
      booking_ref, client_name, client_phone, client_email,
      commodity, shipment_date, processed_by,
      type, vehicle, delivery_type,
      price, toll_cost, distance_km,
      pickup, delivery, country, city, route, status, notes
    } = req.body;

    const result = await db.query(`
      INSERT INTO truck_bookings
        (booking_ref, client_name, client_phone, client_email,
         commodity, shipment_date, processed_by,
         type, vehicle, delivery_type,
         price, toll_cost, distance_km,
         pickup, delivery, country, city, route, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `, [
      booking_ref, client_name, client_phone, client_email,
      commodity, shipment_date || null, processed_by,
      type, vehicle, delivery_type,
      price, toll_cost || 0, distance_km || null,
      pickup, delivery, country || null, city || null, route,
      status || 'confirmed', notes || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('CREATE TRUCK BOOKING ERROR:', err.message);
    res.status(500).json({ error: 'Failed to create truck booking' });
  }
};

// ─────────────────────────────────────────────
// GET ALL TRUCK BOOKINGS
// GET /api/truck-bookings
// ─────────────────────────────────────────────
exports.getAllBookings = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `SELECT * FROM truck_bookings WHERE 1=1`;
    const params = [];
    let idx = 1;

    if (status && status !== 'all') {
      query += ` AND status = $${idx++}`;
      params.push(status);
    }
    if (search) {
      query += ` AND (
        LOWER(client_name)  ILIKE $${idx} OR
        LOWER(booking_ref)  ILIKE $${idx} OR
        LOWER(vehicle)      ILIKE $${idx} OR
        LOWER(route)        ILIKE $${idx}
      )`;
      params.push(`%${search.toLowerCase()}%`);
      idx++;
    }
    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET TRUCK BOOKINGS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch truck bookings' });
  }
};

// ─────────────────────────────────────────────
// GET ONE TRUCK BOOKING
// GET /api/truck-bookings/:ref
// ─────────────────────────────────────────────
exports.getBooking = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM truck_bookings WHERE booking_ref = $1 OR id::text = $1`,
      [req.params.ref]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Booking not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET TRUCK BOOKING ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
};

// ─────────────────────────────────────────────
// UPDATE STATUS
// PATCH /api/truck-bookings/:ref/status
// Body: { status: 'in_transit' | 'delivered' }
// ─────────────────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['confirmed', 'in_transit', 'delivered'];
    if (!valid.includes(status))
      return res.status(400).json({ error: 'Invalid status' });

    const result = await db.query(
      `UPDATE truck_bookings SET status = $1
       WHERE booking_ref = $2 OR id::text = $2
       RETURNING *`,
      [status, req.params.ref]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Booking not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('UPDATE STATUS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// ─────────────────────────────────────────────
// SAVE PICKUP SIGNATURE
// PATCH /api/truck-bookings/:ref/pickup-signature
// Body: { signature: 'data:image/png;base64,...', signed_by: 'John' }
// ─────────────────────────────────────────────
exports.savePickupSignature = async (req, res) => {
  try {
    const { signature, signed_by } = req.body;
    if (!signature) return res.status(400).json({ error: 'Signature required' });

    const result = await db.query(
      `UPDATE truck_bookings
       SET pickup_signature = $1,
           pickup_signed_by = $2,
           pickup_signed_at = NOW(),
           status = CASE WHEN status = 'confirmed' THEN 'in_transit' ELSE status END
       WHERE booking_ref = $3 OR id::text = $3
       RETURNING *`,
      [signature, signed_by || 'Unknown', req.params.ref]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Booking not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PICKUP SIGNATURE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to save pickup signature' });
  }
};

// ─────────────────────────────────────────────
// SAVE DELIVERY SIGNATURE
// PATCH /api/truck-bookings/:ref/delivery-signature
// Body: { signature: 'data:image/png;base64,...', signed_by: 'John' }
// ─────────────────────────────────────────────
exports.saveDeliverySignature = async (req, res) => {
  try {
    const { signature, signed_by } = req.body;
    if (!signature) return res.status(400).json({ error: 'Signature required' });

    const result = await db.query(
      `UPDATE truck_bookings
       SET delivery_signature = $1,
           delivery_signed_by = $2,
           delivery_signed_at = NOW(),
           status = 'delivered'
       WHERE booking_ref = $3 OR id::text = $3
       RETURNING *`,
      [signature, signed_by || 'Unknown', req.params.ref]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Booking not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('DELIVERY SIGNATURE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to save delivery signature' });
  }
};

// ─────────────────────────────────────────────
// MARK AS INVOICED
// PATCH /api/truck-bookings/:ref/mark-invoiced
// Body: { invoice_no: 'INV000025' }
// ─────────────────────────────────────────────
exports.markInvoiced = async (req, res) => {
  try {
    const { invoice_no } = req.body;
    const result = await db.query(
      `UPDATE truck_bookings
       SET invoiced = TRUE, invoice_no = $1
       WHERE booking_ref = $2 OR id::text = $2
       RETURNING *`,
      [invoice_no, req.params.ref]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Booking not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('MARK INVOICED ERROR:', err.message);
    res.status(500).json({ error: 'Failed to mark as invoiced' });
  }
};

// ─────────────────────────────────────────────
// UPDATE NOTES
// PATCH /api/truck-bookings/:ref/notes
// ─────────────────────────────────────────────
exports.updateNotes = async (req, res) => {
  try {
    const { notes } = req.body;
    const result = await db.query(
      `UPDATE truck_bookings SET notes = $1
       WHERE booking_ref = $2 OR id::text = $2
       RETURNING *`,
      [notes, req.params.ref]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('UPDATE NOTES ERROR:', err.message);
    res.status(500).json({ error: 'Failed to update notes' });
  }
};




const db = require('../db');

// ─────────────────────────────────────────────
// CREATE TRUCK INVOICE
// POST /api/truck-invoices
// ─────────────────────────────────────────────
exports.createInvoice = async (req, res) => {
  try {
    const {
      booking_ref, client_name, client_email, client_phone,
      route, vehicle, delivery_type, commodity, shipment_date,
      subtotal, notes, invoice_date
    } = req.body;

    if (!booking_ref || subtotal === undefined || subtotal === null)
      return res.status(400).json({ error: 'booking_ref and subtotal are required' });

    // Check not already invoiced
    const existing = await db.query(
      'SELECT id FROM truck_invoices WHERE booking_ref = $1', [booking_ref]
    );
    if (existing.rows.length)
      return res.status(409).json({ error: 'This booking has already been invoiced', invoice_no: existing.rows[0].invoice_no });

    // Generate invoice number: TINV000001
    const seqResult = await db.query(`SELECT nextval('truck_invoice_seq') AS n`);
    const n = seqResult.rows[0].n;
    const invoice_no = `TINV${String(n).padStart(6, '0')}`;

    const sub     = Number(subtotal);
    const vat     = Math.round(sub * 0.15 * 100) / 100;
    const total   = Math.round((sub + vat) * 100) / 100;

    const result = await db.query(`
      INSERT INTO truck_invoices
        (invoice_no, booking_ref, client_name, client_email, client_phone,
         route, vehicle, delivery_type, commodity, shipment_date,
         subtotal, vat_amount, total, status, notes, invoice_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'unpaid',$14,$15)
      RETURNING *
    `, [
      invoice_no, booking_ref, client_name, client_email, client_phone,
      route, vehicle, delivery_type, commodity, shipment_date || null,
      sub, vat, total, notes || null,
      invoice_date || new Date().toISOString().split('T')[0]
    ]);

    // Mark truck booking as invoiced
    await db.query(
      `UPDATE truck_bookings SET invoiced = TRUE, invoice_no = $1 WHERE booking_ref = $2`,
      [invoice_no, booking_ref]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('CREATE TRUCK INVOICE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to create truck invoice' });
  }
};

// ─────────────────────────────────────────────
// GET ALL TRUCK INVOICES
// GET /api/truck-invoices
// ─────────────────────────────────────────────
exports.getAllInvoices = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT ti.*, tb.pickup, tb.delivery, tb.distance_km, tb.toll_cost, tb.processed_by
      FROM truck_invoices ti
      LEFT JOIN truck_bookings tb ON tb.booking_ref = ti.booking_ref
      ORDER BY ti.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET TRUCK INVOICES ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch truck invoices' });
  }
};

// ─────────────────────────────────────────────
// GET ONE TRUCK INVOICE
// GET /api/truck-invoices/:invoiceNo
// ─────────────────────────────────────────────
exports.getInvoice = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT ti.*, tb.pickup, tb.delivery, tb.city, tb.distance_km, tb.toll_cost,
             tb.processed_by, tb.delivery_note_no,
             tb.receiver_name, tb.receiver_company, tb.receiver_phone, tb.receiver_email
      FROM truck_invoices ti
      LEFT JOIN truck_bookings tb ON tb.booking_ref = ti.booking_ref
      WHERE ti.invoice_no = $1 OR ti.id::text = $1
    `, [req.params.invoiceNo]);

    if (!result.rows.length)
      return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET TRUCK INVOICE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

// ─────────────────────────────────────────────
// GET INVOICE BY BOOKING REF
// GET /api/truck-invoices/booking/:ref
// ─────────────────────────────────────────────
exports.getInvoiceByBooking = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT ti.*, tb.pickup, tb.delivery, tb.city, tb.distance_km, tb.toll_cost,
             tb.processed_by, tb.delivery_note_no,
             tb.receiver_name, tb.receiver_company, tb.receiver_phone, tb.receiver_email
      FROM truck_invoices ti
      LEFT JOIN truck_bookings tb ON tb.booking_ref = ti.booking_ref
      WHERE ti.booking_ref = $1
    `, [req.params.ref]);

    if (!result.rows.length)
      return res.status(404).json({ error: 'No invoice found for this booking' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET INVOICE BY BOOKING ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

// ─────────────────────────────────────────────
// MARK PAID
// PATCH /api/truck-invoices/:invoiceNo/mark-paid
// ─────────────────────────────────────────────
exports.markPaid = async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE truck_invoices SET status = 'paid'
       WHERE invoice_no = $1 RETURNING *`,
      [req.params.invoiceNo]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('MARK PAID ERROR:', err.message);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
};




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

    // Default the invoice's PO/Client Reference to whatever was captured
    // on the booking (if anything) — accountants can still edit it later.
    // Also pull the booking's type so we know whether this is a Cross
    // Border delivery — those are invoiced VAT zero-rated, national
    // deliveries carry the standard 15%.
    const bookingResult = await db.query(
      'SELECT client_reference, type FROM truck_bookings WHERE booking_ref = $1', [booking_ref]
    );
    const defaultReference = bookingResult.rows[0]?.client_reference || null;
    const isCrossBorder = /cross[\s-]?border/i.test(bookingResult.rows[0]?.type || '');

    const sub     = Number(subtotal);
    const vat     = isCrossBorder ? 0 : Math.round(sub * 0.15 * 100) / 100;
    const total   = Math.round((sub + vat) * 100) / 100;

    const result = await db.query(`
      INSERT INTO truck_invoices
        (invoice_no, booking_ref, client_name, client_email, client_phone,
         route, vehicle, delivery_type, commodity, shipment_date,
         subtotal, vat_amount, total, status, notes, invoice_date, client_reference,
         is_cross_border, extra_charges)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'unpaid',$14,$15,$16,$17,'[]'::jsonb)
      RETURNING *
    `, [
      invoice_no, booking_ref, client_name, client_email, client_phone,
      route, vehicle, delivery_type, commodity, shipment_date || null,
      sub, vat, total, notes || null,
      invoice_date || new Date().toISOString().split('T')[0],
      defaultReference, isCrossBorder
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
             tb.receiver_name, tb.receiver_company, tb.receiver_phone, tb.receiver_email,
             tb.client_reference AS booking_client_reference
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
             tb.receiver_name, tb.receiver_company, tb.receiver_phone, tb.receiver_email,
             tb.client_reference AS booking_client_reference
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
// UPDATE PO / CLIENT REFERENCE
// PATCH /api/truck-invoices/:invoiceNo/reference
// Body: { client_reference: 'PO-12345' }
// Lets an accountant type in or correct the PO/client reference
// directly on the invoice, even if it wasn't captured at booking time.
// ─────────────────────────────────────────────
exports.updateReference = async (req, res) => {
  try {
    const { client_reference } = req.body;
    const result = await db.query(
      `UPDATE truck_invoices SET client_reference = $1
       WHERE invoice_no = $2 RETURNING *`,
      [client_reference?.trim() || null, req.params.invoiceNo]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('UPDATE INVOICE REFERENCE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to update reference' });
  }
};

// ─────────────────────────────────────────────
// UPDATE "INVOICE TO" (BILL-TO) DETAILS
// PATCH /api/truck-invoices/:invoiceNo/bill-to
// Body: { client_name, client_company, client_phone, client_email, client_vat_no }
// Lets accounts correct or add to the client's invoice-to details —
// e.g. adding a VAT number a client only provides at invoicing time.
// This edits the invoice's own copy only; it never touches the
// underlying booking or client_addresses record.
// ─────────────────────────────────────────────
exports.updateBillTo = async (req, res) => {
  try {
    const { client_name, client_company, client_phone, client_email, client_vat_no } = req.body;
    const result = await db.query(
      `UPDATE truck_invoices SET
         client_name = $1, client_company = $2, client_phone = $3,
         client_email = $4, client_vat_no = $5
       WHERE invoice_no = $6 RETURNING *`,
      [
        (client_name || '').trim() || null,
        (client_company || '').trim() || null,
        (client_phone || '').trim() || null,
        (client_email || '').trim() || null,
        (client_vat_no || '').trim() || null,
        req.params.invoiceNo
      ]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('UPDATE INVOICE BILL-TO ERROR:', err.message);
    res.status(500).json({ error: 'Failed to update invoice-to details' });
  }
};

// ─────────────────────────────────────────────
// UPDATE CHARGES
// PATCH /api/truck-invoices/:invoiceNo/charges
// Body: { extra_charges: [{ description: 'Detention - 2hrs', amount: 850 }, ...] }
// Lets accounts add/adjust charges that came up after the shipment
// (detention, extra stops, storage, toll adjustments, etc.). Recalculates
// subtotal/VAT/total — VAT stays zero-rated for Cross Border invoices.
// This is a full replace of the charges list (not an append), so the
// frontend sends the complete current set each time.
// ─────────────────────────────────────────────
exports.updateCharges = async (req, res) => {
  try {
    const { extra_charges } = req.body;
    if (!Array.isArray(extra_charges))
      return res.status(400).json({ error: 'extra_charges must be an array' });

    const cleanCharges = extra_charges
      .map(c => ({
        description: String(c.description || '').trim().slice(0, 200),
        amount: Math.round(Number(c.amount || 0) * 100) / 100
      }))
      .filter(c => c.description && c.amount !== 0);

    const current = await db.query('SELECT * FROM truck_invoices WHERE invoice_no = $1', [req.params.invoiceNo]);
    if (!current.rows.length)
      return res.status(404).json({ error: 'Invoice not found' });
    const inv = current.rows[0];

    // inv.subtotal already has any previously-saved charges baked into it,
    // so back those out first, then add the new set — keeps this correct
    // no matter how many times accounts comes back and edits it.
    const oldCharges = Array.isArray(inv.extra_charges) ? inv.extra_charges : [];
    const oldChargesTotal = oldCharges.reduce((s, c) => s + Number(c.amount || 0), 0);
    const baseSubtotal = Math.round((Number(inv.subtotal) - oldChargesTotal) * 100) / 100;

    const newChargesTotal = cleanCharges.reduce((s, c) => s + c.amount, 0);
    const subtotal = Math.round((baseSubtotal + newChargesTotal) * 100) / 100;
    const vat = inv.is_cross_border ? 0 : Math.round(subtotal * 0.15 * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;

    const result = await db.query(`
      UPDATE truck_invoices SET
        subtotal = $1, extra_charges = $2, vat_amount = $3, total = $4
      WHERE invoice_no = $5 RETURNING *`,
      [subtotal, JSON.stringify(cleanCharges), vat, total, req.params.invoiceNo]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('UPDATE TRUCK INVOICE CHARGES ERROR:', err.message);
    res.status(500).json({ error: 'Failed to update invoice charges' });
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






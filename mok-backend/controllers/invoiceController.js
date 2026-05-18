const db = require('../db');

// ─────────────────────────────────────────────
// GET UNINVOICED WAYBILLS FOR A CLIENT
// GET /api/invoices/uninvoiced/:clientId
// ─────────────────────────────────────────────
exports.getUninvoicedWaybills = async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await db.query(`
      SELECT
        w.id,
        w.waybill_no,
        w.weight,
        w.volumetric_weight,
        w.status,
        w.created_at,
        b.service,
        b.consignor_name,
        b.consignee_name,
        b.consignee_address,
        b.price,
        b.zone_label,
        b.booking_date
      FROM waybills w
      LEFT JOIN bookings b ON b.id = w.booking_id
      WHERE b.user_id = $1
        AND (w.invoiced IS NULL OR w.invoiced = FALSE)
      ORDER BY w.created_at DESC
    `, [clientId]);

    res.json(result.rows);
  } catch (err) {
    console.error('GET UNINVOICED WAYBILLS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch uninvoiced waybills' });
  }
};

// ─────────────────────────────────────────────
// GET ALL CLIENTS WHO HAVE UNINVOICED WAYBILLS
// GET /api/invoices/clients-with-waybills
// ─────────────────────────────────────────────
exports.getClientsWithWaybills = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT
        u.id        AS user_id,
        u.name      AS client_name,
        u.email     AS client_email,
        u.company   AS client_company,
        COUNT(w.id) AS uninvoiced_count
      FROM users u
      JOIN bookings b  ON b.user_id = u.id
      JOIN waybills w  ON w.booking_id = b.id
      WHERE (w.invoiced IS NULL OR w.invoiced = FALSE)
      GROUP BY u.id, u.name, u.email, u.company
      ORDER BY u.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET CLIENTS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
};

// ─────────────────────────────────────────────
// CREATE GROUPED INVOICE (multi-waybill)
// POST /api/invoices/grouped
// ─────────────────────────────────────────────
exports.createGroupedInvoice = async (req, res) => {
  const client = await db.connect(); // use transaction
  try {
    await client.query('BEGIN');

    const {
      invoice_no,
      invoice_date,
      client_id,
      client_name,
      waybill_ids,   // array of waybill DB ids
      subtotal,
      vat_total,
      total,
      status
    } = req.body;

    if (!waybill_ids || !waybill_ids.length) {
      return res.status(400).json({ error: 'No waybills selected.' });
    }

    // 1. Insert the invoice
    const invResult = await client.query(`
      INSERT INTO invoices
        (invoice_no, invoice_date, subtotal, vat_total, total,
         status, client_id, client_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      invoice_no,
      invoice_date,
      subtotal,
      vat_total,
      total,
      status || 'unpaid',
      client_id,
      client_name
    ]);

    const invoice = invResult.rows[0];

    // 2. Insert junction rows (invoice ↔ waybills)
    for (const wid of waybill_ids) {
      await client.query(`
        INSERT INTO invoice_waybills (invoice_id, waybill_id)
        VALUES ($1, $2)
      `, [invoice.id, wid]);
    }

    // 3. Mark waybills as invoiced
    await client.query(`
      UPDATE waybills
      SET invoiced = TRUE
      WHERE id = ANY($1::int[])
    `, [waybill_ids]);

    await client.query('COMMIT');
    res.status(201).json(invoice);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('CREATE GROUPED INVOICE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to create invoice.' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// CREATE SINGLE INVOICE (legacy — keep working)
// POST /api/invoices
// ─────────────────────────────────────────────
exports.createInvoice = async (req, res) => {
  try {
    const {
      invoice_no, invoice_date, waybill_no,
      subtotal, vat_total, total, status,
      client_id, client_name
    } = req.body;

    let waybill_id = null;
    if (waybill_no) {
      const wb = await db.query(
        'SELECT id FROM waybills WHERE waybill_no = $1', [waybill_no]
      );
      if (wb.rows.length) waybill_id = wb.rows[0].id;
    }

    const result = await db.query(`
      INSERT INTO invoices
        (invoice_no, invoice_date, waybill_id, subtotal, vat_total,
         total, status, client_id, client_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      invoice_no, invoice_date, waybill_id,
      subtotal, vat_total, total,
      status || 'unpaid', client_id || null, client_name || null
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('CREATE INVOICE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

// ─────────────────────────────────────────────
// GET ALL INVOICES (staff)
// GET /api/invoices
// ─────────────────────────────────────────────
exports.getInvoices = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        i.*,
        w.waybill_no,
        COALESCE(
          (SELECT STRING_AGG(w2.waybill_no, ', ' ORDER BY w2.waybill_no)
           FROM invoice_waybills iw
           JOIN waybills w2 ON w2.id = iw.waybill_id
           WHERE iw.invoice_id = i.id),
          w.waybill_no
        ) AS waybill_nos
      FROM invoices i
      LEFT JOIN waybills w ON w.id = i.waybill_id
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET INVOICES ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

// ─────────────────────────────────────────────
// GET CLIENT INVOICES
// GET /api/invoices/client/:clientId
// ─────────────────────────────────────────────
exports.getClientInvoices = async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await db.query(`
      SELECT
        i.*,
        COALESCE(
          (SELECT STRING_AGG(w2.waybill_no, ', ' ORDER BY w2.waybill_no)
           FROM invoice_waybills iw
           JOIN waybills w2 ON w2.id = iw.waybill_id
           WHERE iw.invoice_id = i.id),
          w.waybill_no
        ) AS waybill_nos
      FROM invoices i
      LEFT JOIN waybills w ON w.id = i.waybill_id
      WHERE i.client_id = $1
      ORDER BY i.created_at DESC
    `, [clientId]);
    res.json(result.rows);
  } catch (err) {
    console.error('GET CLIENT INVOICES ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch client invoices' });
  }
};

// ─────────────────────────────────────────────
// GET ONE INVOICE WITH ALL ITS WAYBILLS
// GET /api/invoices/:id
// ─────────────────────────────────────────────
exports.getInvoiceById = async (req, res) => {
  try {
    // Get invoice
    const invResult = await db.query(`
      SELECT i.*, w.waybill_no
      FROM invoices i
      LEFT JOIN waybills w ON w.id = i.waybill_id
      WHERE i.invoice_no = $1 OR i.id::text = $1
    `, [req.params.id]);

    if (!invResult.rows.length)
      return res.status(404).json({ error: 'Invoice not found' });

    const invoice = invResult.rows[0];

    // Get all waybills linked via junction table
    const wbResult = await db.query(`
      SELECT
        w.id, w.waybill_no, w.weight, w.volumetric_weight, w.status,
        b.service, b.consignor_name, b.consignee_name,
        b.consignee_address, b.price, b.zone_label, b.booking_date
      FROM invoice_waybills iw
      JOIN waybills  w ON w.id = iw.waybill_id
      JOIN bookings  b ON b.id = w.booking_id
      WHERE iw.invoice_id = $1
      ORDER BY w.created_at
    `, [invoice.id]);

    invoice.waybills = wbResult.rows;
    res.json(invoice);
  } catch (err) {
    console.error('GET INVOICE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

// ─────────────────────────────────────────────
// MARK INVOICE AS PAID
// PATCH /api/invoices/:invoiceNo/mark-paid
// ─────────────────────────────────────────────
exports.markPaid = async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE invoices SET status = 'paid'
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



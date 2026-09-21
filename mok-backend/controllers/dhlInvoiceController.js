const db = require('../db');

// ─────────────────────────────────────────────
// GET UNINVOICED DHL SHIPMENTS FOR A CLIENT
// GET /api/dhl-invoices/uninvoiced/:clientId
// Powers the "pick a client, see their shipments" step when building
// a new group invoice.
// ─────────────────────────────────────────────
exports.getUninvoicedShipments = async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await db.query(
      `SELECT * FROM dhl_shipments
       WHERE client_id = $1 AND invoiced = FALSE
       ORDER BY created_at DESC`,
      [clientId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET UNINVOICED DHL SHIPMENTS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch uninvoiced shipments' });
  }
};

// ─────────────────────────────────────────────
// CREATE DHL INVOICE
// POST /api/dhl-invoices
// Body: {
//   client_id, client_name, client_company, client_email, client_phone,
//   client_address, client_vat_no, client_reference, invoice_date, notes,
//   items: [{ dhl_shipment_id, tracking_number, shipment_date,
//             sender_name, sender_address, receiver_name, receiver_address,
//             weight, charge, fuel_surcharge }]
// }
// VAT applies to the "charge" (Basic) amount only, at 15% — the fuel
// surcharge is zero-rated. Confirmed against a real DHL-billed client
// invoice (JNBIR00764337), not assumed.
// ─────────────────────────────────────────────
const VAT_RATE = 0.15;

exports.createInvoice = async (req, res) => {
  try {
    const {
      client_id, client_name, client_company, client_email, client_phone,
      client_address, client_vat_no, client_reference, invoice_date, notes,
      items
    } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'At least one shipment line item is required.' });
    }

    // Generate invoice number: DINV000001
    const seqResult = await db.query(`SELECT nextval('dhl_invoice_seq') AS n`);
    const n = seqResult.rows[0].n;
    const invoice_no = `DINV${String(n).padStart(6, '0')}`;

    const cleanItems = items.map(i => {
      const charge = Math.round(Number(i.charge || 0) * 100) / 100;
      const fuel   = Math.round(Number(i.fuel_surcharge || 0) * 100) / 100;
      const vat    = Math.round(charge * VAT_RATE * 100) / 100;
      const lineTotal = Math.round((charge + fuel + vat) * 100) / 100;
      return {
        dhl_shipment_id: i.dhl_shipment_id || null,
        tracking_number: i.tracking_number || '',
        shipment_date: i.shipment_date || null,
        sender_name: i.sender_name || '',
        sender_address: i.sender_address || '',
        receiver_name: i.receiver_name || '',
        receiver_address: i.receiver_address || '',
        weight: i.weight || null,
        charge, fuel, vat, lineTotal
      };
    });

    const subtotal   = Math.round(cleanItems.reduce((s, i) => s + i.charge + i.fuel, 0) * 100) / 100;
    const vat_amount = Math.round(cleanItems.reduce((s, i) => s + i.vat, 0) * 100) / 100;
    const total       = Math.round((subtotal + vat_amount) * 100) / 100;

    const dueDate = (() => {
      const d = new Date(invoice_date || new Date());
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })();

    const invResult = await db.query(`
      INSERT INTO dhl_invoices
        (invoice_no, client_id, client_name, client_company, client_email,
         client_phone, client_address, client_vat_no, client_reference,
         invoice_date, due_date, subtotal, vat_amount, total, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'unpaid',$15)
      RETURNING *`,
      [
        invoice_no, client_id || null, client_name || null, client_company || null,
        client_email || null, client_phone || null, client_address || null,
        client_vat_no || null, client_reference || null,
        invoice_date || new Date().toISOString().split('T')[0], dueDate,
        subtotal, vat_amount, total, notes || null
      ]
    );
    const invoice = invResult.rows[0];

    for (const i of cleanItems) {
      await db.query(`
        INSERT INTO dhl_invoice_items
          (dhl_invoice_id, dhl_shipment_id, tracking_number, shipment_date,
           sender_name, sender_address, receiver_name, receiver_address,
           weight, charge, fuel_surcharge, vat_amount, line_total)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          invoice.id, i.dhl_shipment_id, i.tracking_number, i.shipment_date,
          i.sender_name, i.sender_address, i.receiver_name, i.receiver_address,
          i.weight, i.charge, i.fuel, i.vat, i.lineTotal
        ]
      );

      if (i.dhl_shipment_id) {
        await db.query(
          `UPDATE dhl_shipments SET invoiced = TRUE, invoice_no = $1 WHERE id = $2`,
          [invoice_no, i.dhl_shipment_id]
        );
      }
    }

    res.status(201).json(invoice);
  } catch (err) {
    console.error('CREATE DHL INVOICE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to create DHL invoice' });
  }
};

// ─────────────────────────────────────────────
// GET ALL DHL INVOICES
// GET /api/dhl-invoices
// ─────────────────────────────────────────────
exports.getAllInvoices = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM dhl_invoices ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET DHL INVOICES ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch DHL invoices' });
  }
};

// ─────────────────────────────────────────────
// GET ONE DHL INVOICE (with line items)
// GET /api/dhl-invoices/:invoiceNo
// ─────────────────────────────────────────────
exports.getInvoice = async (req, res) => {
  try {
    const invResult = await db.query(
      `SELECT * FROM dhl_invoices WHERE invoice_no = $1 OR id::text = $1`,
      [req.params.invoiceNo]
    );
    if (!invResult.rows.length)
      return res.status(404).json({ error: 'Invoice not found' });

    const invoice = invResult.rows[0];
    const itemsResult = await db.query(
      `SELECT * FROM dhl_invoice_items WHERE dhl_invoice_id = $1 ORDER BY id ASC`,
      [invoice.id]
    );

    res.json({ ...invoice, items: itemsResult.rows });
  } catch (err) {
    console.error('GET DHL INVOICE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

// ─────────────────────────────────────────────
// UPDATE PO / CLIENT REFERENCE
// PATCH /api/dhl-invoices/:invoiceNo/reference
// ─────────────────────────────────────────────
exports.updateReference = async (req, res) => {
  try {
    const { client_reference } = req.body;
    const result = await db.query(
      `UPDATE dhl_invoices SET client_reference = $1
       WHERE invoice_no = $2 RETURNING *`,
      [client_reference?.trim() || null, req.params.invoiceNo]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('UPDATE DHL INVOICE REFERENCE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to update reference' });
  }
};

// ─────────────────────────────────────────────
// UPDATE EDITABLE INVOICE-TO DETAILS
// PATCH /api/dhl-invoices/:invoiceNo/details
// Same whitelist-field pattern as truck invoices — one endpoint for
// every editable Invoice To field, so there's only one route to
// remember to register.
// ─────────────────────────────────────────────
const INVOICE_DETAIL_FIELDS = [
  'client_name', 'client_company', 'client_address', 'client_phone',
  'client_email', 'client_vat_no'
];

exports.updateDetails = async (req, res) => {
  try {
    const sets = [];
    const values = [];
    let idx = 1;

    for (const field of INVOICE_DETAIL_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        sets.push(`${field} = $${idx++}`);
        values.push((req.body[field] ?? '').toString().trim() || null);
      }
    }

    if (!sets.length)
      return res.status(400).json({ error: 'No editable fields provided' });

    values.push(req.params.invoiceNo);
    const result = await db.query(
      `UPDATE dhl_invoices SET ${sets.join(', ')}
       WHERE invoice_no = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('UPDATE DHL INVOICE DETAILS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to update invoice details' });
  }
};

// ─────────────────────────────────────────────
// MARK PAID
// PATCH /api/dhl-invoices/:invoiceNo/mark-paid
// ─────────────────────────────────────────────
exports.markPaid = async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE dhl_invoices SET status = 'paid'
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



const db = require('../db');
const dhlService = require('../services/dhlService');

// ─────────────────────────────────────────────
// UN-INVOICED SHIPMENT LOOKUP
//
// The client picker is fed from the address book, but the shipment rows
// carry whatever name was typed/returned when the shipment was created
// ("TRACLO PTY LTD", "Busi Zakwe TRACLO INTERNATIONAL", "Alicewear
// (Pty) Ltd" ...), so an exact/substring match on the full address-book
// name misses real shipments. Instead we match on the *core* words of the
// name — legal suffixes and punctuation are ignored — against both the
// shipper and receiver (either side can be the SA client depending on
// import/export direction).
// ─────────────────────────────────────────────
const NAME_STOPWORDS = new Set([
  'pty', 'ltd', 'limited', 'proprietary', 'cc', 'inc', 'llc',
  'co', 'company', 'international', 'intl', 'the', 'and'
]);

function coreNameTokens(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(t => t && !NAME_STOPWORDS.has(t));
}

// Only the columns the picker needs — SELECT * would drag the base64
// label PDF and full DHL response for every row across the wire.
const UNINVOICED_COLUMNS = `
  id, tracking_number, mode, product_code,
  shipper_name, shipper_country, receiver_name, receiver_country,
  weight, declared_value, declared_currency, ship_date, created_at,
  client_id, client_name, client_company`;

// GET /api/dhl-invoices/uninvoiced/:companyName
exports.getUninvoicedShipments = async (req, res) => {
  try {
    const { companyName } = req.params;
    const tokens = coreNameTokens(companyName);

    let where, params;
    if (!tokens.length) {
      where = `(shipper_name ILIKE $1 OR receiver_name ILIKE $1)`;
      params = [`%${companyName}%`];
    } else {
      const norm = col => `regexp_replace(lower(COALESCE(${col}, '')), '[^a-z0-9]+', ' ', 'g')`;
      const allTokensIn = col => tokens.map((_, i) => `${norm(col)} LIKE $${i + 1}`).join(' AND ');
      where = `((${allTokensIn('shipper_name')}) OR (${allTokensIn('receiver_name')}))`;
      params = tokens.map(t => `%${t}%`);
    }

    const result = await db.query(
      `SELECT ${UNINVOICED_COLUMNS} FROM dhl_shipments
       WHERE invoiced = FALSE AND ${where}
       ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET UNINVOICED DHL SHIPMENTS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch uninvoiced shipments' });
  }
};

// GET /api/dhl-invoices/uninvoiced
// Every shipment that hasn't been invoiced yet — the fallback when the
// name-based lookup doesn't find what the accountant is looking for.
exports.getAllUninvoicedShipments = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ${UNINVOICED_COLUMNS} FROM dhl_shipments
       WHERE invoiced = FALSE
       ORDER BY created_at DESC
       LIMIT 500`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET ALL UNINVOICED DHL SHIPMENTS ERROR:', err.message);
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

// Pulls DHL's own measured weight for a shipment via the same tracking
// call dhlTracking.html already uses (dhlService.trackShipment), so the
// invoice carries what DHL actually weighed it at, not just what was
// declared at booking. Never throws — a lookup failure (bad tracking
// number, DHL API down/slow, no weight in that particular response)
// just means this shipment's reweighed figure stays blank; it must
// never block the invoice from being created.
async function fetchReweighedWeight(trackingNumber) {
  if (!trackingNumber) return null;
  try {
    const result = await dhlService.trackShipment(trackingNumber);
    const shipment = result?.shipments?.[0];
    const w = shipment?.totalWeight;
    return (w !== undefined && w !== null && w !== '') ? Number(w) : null;
  } catch (err) {
    console.error(`DHL reweigh lookup failed for ${trackingNumber}:`, err.message);
    return null;
  }
}

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

    // One DHL tracking call per shipment, run in parallel rather than
    // one-by-one — with 5+ line items this is the difference between a
    // couple of seconds and half a minute for "Create Invoice" to respond.
    const reweighResults = await Promise.allSettled(
      items.map(i => fetchReweighedWeight(i.tracking_number))
    );

    const cleanItems = items.map((i, idx) => {
      const charge = Math.round(Number(i.charge || 0) * 100) / 100;
      const fuel   = Math.round(Number(i.fuel_surcharge || 0) * 100) / 100;
      const vat    = Math.round(charge * VAT_RATE * 100) / 100;
      const lineTotal = Math.round((charge + fuel + vat) * 100) / 100;
      const reweighed = reweighResults[idx].status === 'fulfilled' ? reweighResults[idx].value : null;
      return {
        dhl_shipment_id: i.dhl_shipment_id || null,
        tracking_number: i.tracking_number || '',
        shipment_date: i.shipment_date || null,
        sender_name: i.sender_name || '',
        sender_address: i.sender_address || '',
        receiver_name: i.receiver_name || '',
        receiver_address: i.receiver_address || '',
        weight: i.weight || null,
        reweighed_weight: reweighed,
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
           weight, reweighed_weight, charge, fuel_surcharge, vat_amount, line_total)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          invoice.id, i.dhl_shipment_id, i.tracking_number, i.shipment_date,
          i.sender_name, i.sender_address, i.receiver_name, i.receiver_address,
          i.weight, i.reweighed_weight, i.charge, i.fuel, i.vat, i.lineTotal
        ]
      );

      if (i.dhl_shipment_id) {
        // Mirror the reweighed figure back onto the shipment itself (not
        // just the invoice line item) so dhlShipments.html's "Reweighed
        // Wt" column has something to show without re-querying DHL.
        await db.query(
          `UPDATE dhl_shipments
           SET invoiced = TRUE, invoice_no = $1, reweighed_weight = $2
           WHERE id = $3`,
          [invoice_no, i.reweighed_weight, i.dhl_shipment_id]
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






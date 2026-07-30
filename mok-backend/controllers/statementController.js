const db = require('../db');

// ─────────────────────────────────────────────────────────
// GET ALL CLIENTS (for dropdown — grouped by company)
// GET /api/statements/clients
// ─────────────────────────────────────────────────────────
exports.getAllClients = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id,
        u.name,
        COALESCE(NULLIF(TRIM(u.company), ''), u.name) AS company,
        u.email,
        COUNT(DISTINCT i.id) AS invoice_count,
        COALESCE(SUM(
          CASE WHEN LOWER(i.status) != 'paid'
          THEN i.total ELSE 0 END
        ), 0) AS outstanding
      FROM users u
      LEFT JOIN invoices i ON i.client_id = u.id
      WHERE u.role = 'client'
      GROUP BY u.id, u.name, u.company, u.email
      ORDER BY COALESCE(NULLIF(TRIM(u.company),''), u.name) ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET CLIENTS ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────
// GET CLIENT STATEMENT BY CLIENT ID
// GET /api/statements/client/:clientId
// Uses company name to group — finds all users from same company
// ─────────────────────────────────────────────────────────
exports.getClientStatement = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { from, to } = req.query; // optional date filters

    // 1. Get client details to find their company
    const clientResult = await db.query(
      `SELECT id, name, company, email FROM users WHERE id = $1`,
      [clientId]
    );
    if (!clientResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const client = clientResult.rows[0];
    // Use company name if available, else fall back to name
    const companyName = (client.company && client.company.trim())
      ? client.company.trim()
      : client.name;

    // 2. Find ALL user IDs from the same company
    //    (in case multiple users registered under same company)
    const siblingsResult = await db.query(
      `SELECT id FROM users
       WHERE role = 'client'
         AND (
           LOWER(TRIM(company)) = LOWER($1)
           OR id = $2
         )`,
      [companyName, clientId]
    );
    const clientIds = siblingsResult.rows.map(r => r.id);

    // 3. Build invoice query with optional date range
    let invoiceQuery = `
      SELECT
        i.id,
        COALESCE(i.invoice_no, CONCAT('WB-', w.waybill_no)) AS invoice_no,
        COALESCE(i.invoice_date, w.created_at) AS invoice_date,
        COALESCE(i.subtotal, b.price, 0) AS subtotal,
        COALESCE(i.vat_total, ROUND(COALESCE(b.price, 0) * 0.15, 2), 0) AS vat_total,
        COALESCE(i.total, ROUND(COALESCE(b.price, 0) * 1.15, 2), 0) AS total,
        COALESCE(i.status, 'unpaid') AS status,
        COALESCE(i.created_at, w.created_at) AS created_at,
        COALESCE(i.client_name, b.consignor_name) AS client_name,
        w.waybill_no AS waybill_nos
      FROM waybills w
      JOIN bookings b ON b.id = w.booking_id
      LEFT JOIN invoices i ON i.waybill_id = w.id
      WHERE b.user_id = ANY($1::int[])
    `;
    const params = [clientIds];
    let paramIdx = 2;

    if (from) {
      invoiceQuery += ` AND COALESCE(i.invoice_date, w.created_at::date) >= $${paramIdx}`;
      params.push(from); paramIdx++;
    }
    if (to) {
      invoiceQuery += ` AND COALESCE(i.invoice_date, w.created_at::date) <= $${paramIdx}`;
      params.push(to); paramIdx++;
    }
    invoiceQuery += ' ORDER BY invoice_date DESC, created_at DESC';
    const invoicesResult = await db.query(invoiceQuery, params);
    const invoices = invoicesResult.rows;

    // 4. Calculate summary
    let totalInvoiced = 0;
    let totalPaid = 0;
    let outstandingBalance = 0;

    invoices.forEach(inv => {
      const amount = Number(inv.total || 0);
      totalInvoiced += amount;
      if ((inv.status || '').toLowerCase() === 'paid') {
        totalPaid += amount;
      } else {
        outstandingBalance += amount;
      }
    });

    res.json({
      success: true,
      client: {
        id: clientId,
        name: client.name,
        company: companyName,
        email: client.email
      },
      summary: { totalInvoiced, totalPaid, outstandingBalance },
      invoices
    });

  } catch (err) {
    console.error('STATEMENT ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};




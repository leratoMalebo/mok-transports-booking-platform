const db = require('../db');

// CREATE INVOICE
exports.createInvoice = async (req, res) => {
  try {
    const {
      invoice_no,
      invoice_date,
      waybill_no,
      subtotal,
      vat_total,
      total,
      status
    } = req.body;

    let waybill_id = null;

    if (waybill_no) {
      const wb = await db.query(
        'SELECT id FROM waybills WHERE waybill_no = $1',
        [waybill_no]
      );

      if (wb.rows.length) {
        waybill_id = wb.rows[0].id;
      }
    }

    const result = await db.query(
      `INSERT INTO invoices 
      (invoice_no, invoice_date, waybill_id, subtotal, vat_total, total, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        invoice_no,
        invoice_date,
        waybill_id,
        subtotal,
        vat_total,
        total,
        status || 'unpaid'
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('CREATE INVOICE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

// GET ALL INVOICES
exports.getInvoices = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        i.*,
        w.waybill_no
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

// GET ONE INVOICE
exports.getInvoiceById = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        i.*,
        w.waybill_no
      FROM invoices i
      LEFT JOIN waybills w ON w.id = i.waybill_id
      WHERE i.id = $1 OR i.invoice_no = $1
    `, [req.params.id]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET INVOICE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};


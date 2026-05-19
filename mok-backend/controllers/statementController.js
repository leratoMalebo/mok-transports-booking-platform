const pool = require("../db");

// =======================================================
// GET CLIENT STATEMENT
// =======================================================

exports.getClientStatement = async (req, res) => {

  try {

    const { clientId } = req.params;

    // ===================================================
    // GET CLIENT INVOICES
    // ===================================================

    const invoicesResult = await pool.query(`
      SELECT
        id,
        invoice_no,
        total,
        subtotal,
        vat_total,
        status,
        invoice_date,
        created_at,
        client_id,
        client_name,
        waybill_id
      FROM invoices
      WHERE client_id = $1
      ORDER BY created_at DESC
    `, [clientId]);

    const invoices = invoicesResult.rows;

    // ===================================================
    // CALCULATE TOTALS
    // ===================================================

    let totalInvoiced = 0;
    let totalPaid = 0;
    let outstandingBalance = 0;

    invoices.forEach(inv => {

      const amount = Number(inv.total || 0);

      totalInvoiced += amount;

      if (
        (inv.status || "").toLowerCase() === "paid"
      ) {
        totalPaid += amount;
      } else {
        outstandingBalance += amount;
      }

    });

    // ===================================================
    // CLIENT DETAILS
    // ===================================================

    const clientName =
      invoices.length > 0
        ? invoices[0].client_name
        : "Unknown Client";

    // ===================================================
    // RESPONSE
    // ===================================================

    res.json({

      success: true,

      client: {
        id: clientId,
        name: clientName
      },

      summary: {
        totalInvoiced,
        totalPaid,
        outstandingBalance
      },

      invoices

    });

  } catch (error) {

    console.error(
      "STATEMENT ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


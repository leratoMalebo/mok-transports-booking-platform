const db = require('../db');

const jkjService = require('../services/jkjService');

// CREATE WAYBILL
exports.createWaybill = async (req, res) => {
  try {
    const {
      booking_id,
      waybill_no,
      weight,
      volumetric_weight
    } = req.body;

    const result = await db.query(
      `INSERT INTO waybills 
      (booking_id, waybill_no, weight, volumetric_weight)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [booking_id, waybill_no, weight, volumetric_weight]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('CREATE WAYBILL ERROR:', err.message);
    res.status(500).json({ error: 'Failed to create waybill' });
  }
};

// GET ALL WAYBILLS
exports.getWaybills = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        w.*,
        b.service,
        b.consignor_name,
        b.consignee_name,
        b.price
      FROM waybills w
      LEFT JOIN bookings b ON b.id = w.booking_id
      ORDER BY w.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('GET WAYBILLS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch waybills' });
  }
};

// SEND WAYBILL TO JKJ
exports.sendToJKJ = async (req, res) => {
  try {
    const { waybillNo } = req.params;

    const check = await db.query(
      `SELECT 
        w.*,
        b.service,
        b.consignor_name,
        b.consignor_address,
       b.consignor_contact,
b.consignor_contact_name,
b.consignor_suburb,
b.consignor_town,
b.consignee_name,
b.consignee_address,
b.consignee_contact,
b.consignee_contact_name,
b.consignee_suburb,
b.consignee_town,
        b.price
      FROM waybills w
      LEFT JOIN bookings b ON b.id = w.booking_id
      WHERE w.waybill_no = $1`,
      [waybillNo]
    );

    if (!check.rows.length) {
      return res.status(404).json({ error: 'Waybill not found' });
    }

    const waybill = check.rows[0];

    if (waybill.sent_to_jkj === true) {
      return res.status(400).json({ error: 'Waybill already sent to JKJ' });
    }

    const jkjResult = await jkjService.submitWaybillToJKJ(waybill);

    const jkjReference =
      jkjResult?.results?.[0]?.waybillno ||
      jkjResult?.results?.[0]?.histid ||
      null;

    const updated = await db.query(
      `UPDATE waybills
   SET sent_to_jkj = true,
       status = 'sent_to_jkj',
       jkj_reference = $1,
       jkj_response = $2
   WHERE waybill_no = $3
   RETURNING *`,
      [
        jkjReference,
        JSON.stringify(jkjResult),
        waybillNo
      ]
    );

    res.json({
      message: 'Waybill sent to JKJ successfully',
      jkjResponse: jkjResult,
      waybill: updated.rows[0]
    });

  } catch (err) {
    console.error('SEND TO JKJ ERROR:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to send waybill to JKJ' });
  }
};

// SEARCH WAYBILLS
exports.searchWaybills = async (req, res) => {
  try {
    const q = req.query.q || '';

    const result = await db.query(
      `
      SELECT 
        w.*,
        b.service,
        b.consignor_name,
        b.consignee_name,
        b.price
      FROM waybills w
      LEFT JOIN bookings b ON b.id = w.booking_id
      WHERE 
        w.waybill_no ILIKE $1
        OR w.status ILIKE $1
        OR b.service ILIKE $1
        OR b.consignor_name ILIKE $1
        OR b.consignee_name ILIKE $1
      ORDER BY w.created_at DESC
      `,
      [`%${q}%`]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('SEARCH WAYBILLS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to search waybills' });
  }
};


// GET SINGLE WAYBILL BY WAYBILL NUMBER
exports.getWaybillByNumber = async (req, res) => {
  try {
    const { waybillNo } = req.params;

    const result = await db.query(
      `SELECT 
        w.*,
        b.booking_date,
        b.service,
        b.consignor_name,
        b.consignor_address,
       b.consignor_contact,
b.consignor_contact,
b.consignor_contact_name,
b.consignor_suburb,
b.consignor_town,
b.consignee_name,
b.consignee_address,
b.consignee_contact,
b.consignee_contact_name,
b.consignee_suburb,
b.consignee_town,
        b.price,
        b.zone_label
       FROM waybills w
       LEFT JOIN bookings b ON b.id = w.booking_id
       WHERE w.waybill_no = $1`,
      [waybillNo]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Waybill not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('GET WAYBILL ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch waybill' });
  }
};







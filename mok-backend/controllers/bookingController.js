// CREATE BOOKING
const db = require('../db');

// CREATE BOOKING
exports.createBooking = async (req, res) => {
  try {
    const {
      user_id,
      service,
      consignor_name,
      consignor_address,
      consignor_contact,
      consignee_name,
      consignee_address,
      consignee_contact,
      weight,
      volumetric_weight,
      price,
      zone_label
    } = req.body;

    const result = await db.query(
      `INSERT INTO bookings 
      (user_id, service, consignor_name, consignor_address, consignor_contact,
       consignee_name, consignee_address, consignee_contact,
       weight, volumetric_weight, price, zone_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        user_id,
        service,
        consignor_name,
        consignor_address,
        consignor_contact,
        consignee_name,
        consignee_address,
        consignee_contact,
        weight,
        volumetric_weight,
        price,
        zone_label
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Booking creation failed' });
  }
};

// GET ALL BOOKINGS
exports.getAllBookings = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM bookings ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

// GET ONE BOOKING
exports.getBookingById = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
};


// CREATE BOOKING
const db = require('../db');

const emailService = require('../services/emailService');

// CREATE BOOKING
exports.createBooking = async (req, res) => {
  try {
    const {
      user_id,
      service,
      booking_date,

      consignor_name,
      consignor_address,
      consignor_address2,
      consignor_contact,
      consignor_contact_name,
      consignor_suburb,
      consignor_town,
      consignor_province,
      consignor_postcode,

      consignee_name,
      consignee_address,
      consignee_address2,
      consignee_contact,
      consignee_contact_name,
      consignee_suburb,
      consignee_town,
      consignee_province,
      consignee_postcode,

      weight,
      volumetric_weight,
      price,
      zone_label
    } = req.body;

    const result = await db.query(
      `INSERT INTO bookings 
      (
  user_id,
  service,
  booking_date,

 consignor_name,
consignor_address,
consignor_address2,
consignor_contact,
consignor_contact_name,
consignor_suburb,
consignor_town,
consignor_province,
consignor_postcode,

consignee_name,
consignee_address,
consignee_address2,
consignee_contact,
consignee_contact_name,
consignee_suburb,
consignee_town,
consignee_province,
consignee_postcode,

  weight,
  volumetric_weight,
  price,
  zone_label
)
       VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
  $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
  $21,$22,$23,$24,$25
)
       RETURNING *`,
      [
        user_id,
        service,
        booking_date || null,

        consignor_name,
        consignor_address,
        consignor_address2,
        consignor_contact,
        consignor_contact_name,
        consignor_suburb,
        consignor_town,
        consignor_province,
        consignor_postcode,

        consignee_name,
        consignee_address,
        consignee_address2,
        consignee_contact,
        consignee_contact_name,
        consignee_suburb,
        consignee_town,
        consignee_province,
        consignee_postcode,

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










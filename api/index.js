require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const ALLOWED_ORIGINS = [
  'https://bookings.moktransports.com',
  'https://mok-transports-booking-platform.vercel.app'
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('CORS blocked'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// ----------------------------------------------------------------
// Routes — WITH /api prefix because Vercel does NOT strip it
// ----------------------------------------------------------------
app.use('/api/auth', require('../mok-backend/routes/Auth'));
app.use('/api/client', require('../mok-backend/routes/clientPortal'));
app.use('/api/bookings', require('../mok-backend/routes/bookings'));
app.use('/api/waybills', require('../mok-backend/routes/waybills'));
app.use('/api/invoices', require('../mok-backend/routes/invoices'));
app.use("/api/statements",require("../mok-backend/routes/statements"));
app.use('/api/clients',require('../mok-backend/routes/client'));
app.use('/api/tracking', require('../mok-backend/routes/tracking'));
app.use('/api/dhl', require('../mok-backend/routes/dhl'));
app.use('/api/truck-bookings', require('../mok-backend/routes/truckBookings'));
app.use('/api/truck-invoices', require('../mok-backend/routes/truckInvoices'));
app.use('/api/addresses', require('../mok-backend/routes/addresses'));
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Mok Transports API live' });
});

module.exports = app;








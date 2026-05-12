require('dotenv').config({ path: '../mok-backend/.env' });
const express = require('express');
const cors    = require('cors');
const app     = express();

const ALLOWED_ORIGINS = [
  'https://bookings.moktransports.com',
  'https://mok-transports-booking-platform.vercel.app'
];

// ----------------------------------------------------------------
// CORS — handles both allowed origins dynamically.
// vercel.json no longer sets CORS headers so Express is in control.
// ----------------------------------------------------------------
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('CORS blocked'));
    }
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

// ----------------------------------------------------------------
// Preflight — respond to OPTIONS for every route.
// Dynamically mirrors the requesting origin so both domains work.
// ----------------------------------------------------------------
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use(express.json());

// ----------------------------------------------------------------
// Routes
// NOTE: /api prefix is removed here because Vercel's rewrite rule
// already strips it before the request reaches this Express app.
// e.g. POST /api/auth/login → Express sees → POST /auth/login
// ----------------------------------------------------------------
app.use('/auth',     require('../mok-backend/routes/Auth'));
app.use('/client',   require('../mok-backend/routes/Clients'));
app.use('/bookings', require('../mok-backend/routes/bookings'));
app.use('/waybills', require('../mok-backend/routes/waybills'));
app.use('/invoices', require('../mok-backend/routes/invoices'));



app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Mok Transports API live' });
});

module.exports = app;


// ============================================================
// api/index.js
// Vercel Serverless Function entry point
// Location in your repo: YOUR_REPO_ROOT/api/index.js
// (same level as server.js, inside a folder called "api")
// ============================================================

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();

const ALLOWED_ORIGINS = [
  'https://bookings.moktransports.com',
  'https://mok-transports-booking-platform.vercel.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5000'
];

app.use(cors({
  origin: (origin, cb) =>
    (!origin || ALLOWED_ORIGINS.includes(origin)) ? cb(null, true) : cb(new Error('CORS blocked')),
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));
app.options('*', cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Mok Transports API live', time: new Date().toISOString() });
});

// Routes — one level up from this file
app.use('/api/auth',     require('../routes/auth'));
app.use('/api/client',   require('../routes/clients'));
app.use('/api/bookings', require('../routes/bookings'));
app.use('/api/waybills', require('../routes/waybills'));
app.use('/api/invoices', require('../routes/invoices'));

// JSON 404 — never return HTML
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// JSON error handler
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;



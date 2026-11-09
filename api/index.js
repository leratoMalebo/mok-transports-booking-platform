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
// safeUse — mounts a route file, but if that file is missing or has an
// error, ONLY that route is disabled (it answers 503 with a JSON message)
// and the exact reason is written to the Vercel logs. Before this, one bad
// route file crashed the whole API and every page showed "500".
// NOTE: keep the require() written out literally inside the arrow function
// so Vercel still bundles the file.
// ----------------------------------------------------------------
function safeUse(path, loader) {
  try {
    app.use(path, loader());
  } catch (err) {
    console.error(`[ROUTES] FAILED to load ${path} ->`, err.message);
    app.use(path, (req, res) =>
      res.status(503).json({ error: `Service temporarily unavailable (${path})` })
    );
  }
}

// ----------------------------------------------------------------
// Routes — WITH /api prefix because Vercel does NOT strip it
// ----------------------------------------------------------------
safeUse('/api/auth', () => require('../mok-backend/routes/Auth'));
safeUse('/api/client', () => require('../mok-backend/routes/clientPortal'));
safeUse('/api/bookings', () => require('../mok-backend/routes/bookings'));
safeUse('/api/waybills', () => require('../mok-backend/routes/waybills'));
safeUse('/api/invoices', () => require('../mok-backend/routes/invoices'));
safeUse('/api/statements', () => require('../mok-backend/routes/statements'));
safeUse('/api/clients', () => require('../mok-backend/routes/client'));
safeUse('/api/tracking', () => require('../mok-backend/routes/tracking'));
safeUse('/api/dhl', () => require('../mok-backend/routes/dhl'));
safeUse('/api/truck-bookings', () => require('../mok-backend/routes/truckBookings'));
safeUse('/api/truck-invoices', () => require('../mok-backend/routes/truckInvoices'));
safeUse('/api/dhl-invoices', () => require('../mok-backend/routes/dhlInvoices'));
safeUse('/api/addresses', () => require('../mok-backend/routes/addresses'));
safeUse('/api/trip-finance', () => require('../mok-backend/routes/tripFinanceRoutes'));

safeUse('/api/hr', () => require('../mok-backend/routes/hr'));

// ✅ Fix the casing (Dhladdresses) and change the endpoint route so it doesn't conflict with line 40
safeUse('/api/dhl-addresses', () => require('../mok-backend/routes/Dhladdresses'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Mok Transports API live' });
});

module.exports = app;

















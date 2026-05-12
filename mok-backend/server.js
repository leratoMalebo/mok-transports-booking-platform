require("dotenv").config();
const express = require('express');
const cors    = require('cors');
const app     = express();

// ================================================================
// CORS
// ================================================================
const ALLOWED_ORIGINS = [
  'https://bookings.moktransports.com',
  'https://mok-transports-booking-platform.vercel.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://localhost:5000'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, server-to-server, curl)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight for all routes

// ================================================================
// BODY PARSER
// ================================================================
app.use(express.json());

// ================================================================
// HEALTH CHECK — test this first after deploy:
// https://bookings.moktransports.com/api/health
// Should return: { "status": "OK" }
// ================================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Mok Transports API is live', time: new Date().toISOString() });
});

// ================================================================
// ROUTES
// ================================================================
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/client',   require('./routes/clients'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/waybills', require('./routes/waybills'));
app.use('/api/invoices', require('./routes/invoices'));

// ================================================================
// 404 — always return JSON so frontend never gets "Unexpected end
// of JSON input" from an HTML error page
// ================================================================
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// ================================================================
// GLOBAL ERROR HANDLER
// ================================================================
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// ================================================================
// EXPORT FOR VERCEL — do NOT call app.listen() in production
// ================================================================
module.exports = app;

// Local dev only
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Running locally on port ${PORT}`));
}


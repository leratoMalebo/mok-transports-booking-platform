require("dotenv").config();
const express = require('express');
const cors    = require('cors');
const app     = express();

// ================================================================
// CORS — all domains that are allowed to call this API
// ================================================================
const ALLOWED_ORIGINS = [
  'https://bookings.moktransports.com',          // custom domain (primary)
  'https://mok-transports-booking-platform.vercel.app', // vercel default
  'http://localhost:5500',                         // VS Code Live Server
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://localhost:5000'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply CORS to all routes
app.use(cors(corsOptions));

// Handle preflight OPTIONS for every route
app.options('*', cors(corsOptions));

// Body parser
app.use(express.json());

// ================================================================
// ROUTES
// ================================================================
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/client',   require('./routes/clients'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/waybills', require('./routes/waybills'));
app.use('/api/invoices', require('./routes/invoices'));

// ================================================================
// HEALTH CHECK — visit /api/health in browser to confirm API is up
// ================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status:  'OK',
    message: 'Mok Transports API is live',
    time:    new Date().toISOString()
  });
});

// ================================================================
// 404 FALLBACK — returns JSON, never HTML (prevents "Unexpected
// end of JSON input" errors on the frontend)
// ================================================================
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ================================================================
// GLOBAL ERROR HANDLER — also returns JSON, not HTML
// ================================================================
app.use((err, req, res, next) => {
  console.error('UNHANDLED ERROR:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// ================================================================
// EXPORT FOR VERCEL (serverless)
// Local dev: node server.js or nodemon server.js
// ================================================================
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}


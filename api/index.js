require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();

const ALLOWED_ORIGINS = [
  'https://bookings.moktransports.com',
  'https://mok-transports-booking-platform.vercel.app'
];

// Standardized CORS setup
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

// Use the standard '*' for preflight to avoid PathToRegexp errors
app.options('*', cors());

app.use(express.json());

// Health check to verify the engine is running
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Mok Transports API live', 
    timestamp: new Date().toISOString() 
  });
});

// Routing to the mok-backend folder based on your screenshots
// Using exact file names: Auth.js and Clients.js
app.use('/api/auth',     require('../mok-backend/routes/Auth'));
app.use('/api/client',   require('../mok-backend/routes/Clients'));
app.use('/api/bookings', require('../mok-backend/routes/bookings'));
app.use('/api/waybills', require('../mok-backend/routes/waybills'));
app.use('/api/invoices', require('../mok-backend/routes/invoices'));

module.exports = app;


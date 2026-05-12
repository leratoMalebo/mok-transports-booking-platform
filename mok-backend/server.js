require("dotenv").config();
const express = require('express');
const cors = require('cors');

const app = express();

// 1. ADVANCED CORS CONFIGURATION
const corsOptions = {
  origin: [
    'https://bookings.moktransports.com',
    'https://mok-transports-booking-platform.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 2. PREFLIGHT HANDLER (The fix for your specific error)
app.options('*', cors(corsOptions));

app.use(express.json());

// 3. ROUTES
// These must match your folder structure exactly
app.use('/api/auth',     require('./routes/auth'));      
app.use('/api/client',   require('./routes/clients'));   
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/waybills', require('./routes/waybills'));
app.use('/api/invoices', require('./routes/invoices'));

// 4. HEALTH CHECK (To test if the API is alive)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Mok Transports API is Live' });
});

// 5. EXPORT FOR VERCEL
module.exports = app;

// Keep for local testing
if (process.env.NODE_ENV !== 'production') {
  app.listen(5000, () => console.log('Server running locally on port 5000'));
}


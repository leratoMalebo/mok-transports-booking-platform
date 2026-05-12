// No need to point to a .env file on Vercel; it uses the Dashboard variables automatically
require('dotenv').config(); 
const express = require('express');
const cors    = require('cors');
const app     = express();

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
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

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

// IMPORTANT: You must use app.use() to connect the routes
app.use('/api/auth',     require('../routes/Auth'));
app.use('/api/client',   require('../routes/Clients'));
app.use('/api/bookings', require('../routes/bookings'));
app.use('/api/waybills', require('../routes/waybills'));
app.use('/api/invoices', require('../routes/invoices'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Mok Transports API live' });
});

module.exports = app;


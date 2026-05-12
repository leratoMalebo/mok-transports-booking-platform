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

// This is the "Magic Fix" for the preflight error you are seeing
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://bookings.moktransports.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.use(express.json());

// Routes - using ../ because the routes folder is in the root, one level up
app.use('/api/auth',     require('../routes/auth'));
app.use('/api/client',   require('../routes/clients'));
app.use('/api/bookings', require('../routes/bookings'));
app.use('/api/waybills', require('../routes/waybills'));
app.use('/api/invoices', require('../routes/invoices'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Mok Transports API live' });
});

module.exports = app;




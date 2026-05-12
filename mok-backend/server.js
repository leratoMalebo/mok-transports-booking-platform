require("dotenv").config();

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'https://mok-transports-booking-platform.vercel.app',
    'https://bookings.moktransports.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

app.use('/api/auth',     require('./routes/auth'));      // register + login (NEW)
app.use('/api/client',   require('./routes/clients'));   // client waybills + stats (NEW)
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/waybills', require('./routes/waybills'));
app.use('/api/invoices', require('./routes/invoices'));

app.listen(5000, () => console.log('Server running on port 5000'));


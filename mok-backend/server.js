require("dotenv").config();

const express = require('express');
const cors = require('cors');

const app = express();

const corsOptions = {
  origin: [
    'https://bookings.moktransports.com',
    'https://mok-transports-booking-platform.vercel.app',
    'http://localhost:3000', // Keep for local testing
    'http://localhost:5000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // This handles the "preflight" check

app.use(express.json());

app.use('/api/auth',     require('./routes/auth'));      // register + login (NEW)
app.use('/api/client',   require('./routes/clients'));   // client waybills + stats (NEW)
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/waybills', require('./routes/waybills'));
app.use('/api/invoices', require('./routes/invoices'));

app.listen(5000, () => console.log('Server running on port 5000'));




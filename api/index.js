const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());

app.use(express.json());

/* =========================================
   HEALTH CHECK
========================================= */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Mok Transports API running"
  });
});

/* =========================================
   ROUTES
========================================= */

app.use("/api/auth", require("../mok-backend/routes/Auth"));
app.use("/api/clients", require("../mok-backend/routes/Clients"));
app.use("/api/bookings", require("../mok-backend/routes/bookings"));
app.use("/api/invoices", require("../mok-backend/routes/invoices"));
app.use("/api/waybills", require("../mok-backend/routes/waybills"));

/* =========================================
   ERROR HANDLER
========================================= */
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(500).json({
    success: false,
    error: err.message
  });
});

module.exports = app;



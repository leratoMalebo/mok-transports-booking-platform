require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const corsOptions = {
  origin: [
    "https://bookings.moktransports.com",
    "https://mok-transports-booking-platform.vercel.app",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Mok Transports API is running" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/client", require("./routes/clients"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/waybills", require("./routes/waybills"));
app.use("/api/invoices", require("./routes/invoices"));

if (process.env.NODE_ENV !== "production") {
  app.listen(5000, () => console.log("Server running on port 5000"));
}

module.exports = app;


const express = require("express");
const router = express.Router();

const {
    getAllClients
} = require("../controllers/statementController");

router.get("/", getAllClients);

module.exports = router;



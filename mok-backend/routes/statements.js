const express = require("express");
const router = express.Router();

const statementController =
require("../controllers/statementController");

router.get(
  "/client/:clientId",
  statementController.getClientStatement
);

module.exports = router;



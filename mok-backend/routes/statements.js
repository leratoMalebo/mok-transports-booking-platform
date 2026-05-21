const express              = require('express');
const router               = express.Router();
const statementController  = require('../controllers/statementController');

// GET /api/statements/clients — dropdown list (company grouped)
router.get('/clients',          statementController.getAllClients);

// GET /api/statements/client/:clientId — full statement
router.get('/client/:clientId', statementController.getClientStatement);

module.exports = router;


// =============================================================
// mok-backend/routes/Auth.js
// Authentication routes — register, login, profile
// =============================================================

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/Authcontroller');

// POST /api/auth/register
router.post('/register', controller.register);

// POST /api/auth/login
router.post('/login', controller.login);

// GET  /api/auth/profile/:id
router.get('/profile/:id', controller.getProfile);

module.exports = router;


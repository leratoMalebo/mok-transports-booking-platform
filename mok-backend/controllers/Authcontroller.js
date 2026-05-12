// =============================================================
// mok-backend/controllers/authController.js
// Handles register + login for ALL users (clients, staff, admin)
// npm install bcrypt  (run once in mok-backend folder)
// =============================================================

const db     = require('../db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// ---------------------------------------------------------------
// POST /api/auth/register
// Clients only — staff are inserted by admin via migration SQL
// Body: { name, email, password, company, phone }
// ---------------------------------------------------------------
exports.register = async (req, res) => {
  try {
    const { name, email, password, company, phone } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'An account with this email already exists.' });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await db.query(
      `INSERT INTO users (name, email, password, company, phone, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, 'client', TRUE, NOW())
       RETURNING id, name, email, company, phone, role, created_at`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        hashed,
        (company || '').trim(),
        (phone   || '').trim()
      ]
    );

    const user = result.rows[0];
    res.status(201).json({
      message: 'Registration successful.LOGIN.',
      user: { id: user.id, name: user.name, email: user.email, company: user.company, phone: user.phone, role: user.role }
    });

  } catch (err) {
    console.error('REGISTER ERROR:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

// ---------------------------------------------------------------
// POST /api/auth/login
// Works for ALL roles: client, staff, admin
// Returns role — frontend decides where to redirect
// Body: { email, password }
// ---------------------------------------------------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const result = await db.query(
      `SELECT id, name, email, password, company, phone, role, is_active
       FROM users WHERE LOWER(email) = LOWER($1)`,
      [email.trim()]
    );

    if (!result.rows.length)
      return res.status(401).json({ error: 'Incorrect email or password.' });

    const user = result.rows[0];

    if (!user.is_active)
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact Mok Transports.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'Incorrect email or password.' });

    // role = 'client'  → frontend sends to clientDashboard.html
    // role = 'staff'   → frontend sends to dashboard.html
    // role = 'admin'   → frontend sends to dashboard.html
    res.json({
      message: 'Login successful.',
      user: {
        id:      user.id,
        name:    user.name,
        email:   user.email,
        company: user.company || '',
        phone:   user.phone   || '',
        role:    user.role
      }
    });

  } catch (err) {
    console.error('LOGIN ERROR:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

// ---------------------------------------------------------------
// GET /api/auth/profile/:id
// ---------------------------------------------------------------
exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT id, name, email, company, phone, role, created_at FROM users WHERE id = $1`,
      [id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'User not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET PROFILE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
};


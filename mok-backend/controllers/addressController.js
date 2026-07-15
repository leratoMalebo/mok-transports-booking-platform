const db = require('../db');

// GET /api/addresses/companies — distinct company names for dropdown
exports.getCompanies = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT company_name FROM client_addresses
       ORDER BY company_name ASC`
    );
    res.json(result.rows.map(r => r.company_name));
  } catch (err) {
    console.error('GET COMPANIES ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
};

// GET /api/addresses?company=Otis&type=local
exports.getAddresses = async (req, res) => {
  try {
    const { company, type } = req.query;
    let query = `SELECT * FROM client_addresses WHERE 1=1`;
    const params = [];
    let idx = 1;

    if (company) {
      query += ` AND LOWER(company_name) = LOWER($${idx++})`;
      params.push(company);
    }
    if (type) {
      query += ` AND (type = $${idx++} OR type = 'both' OR type IS NULL)`;
      params.push(type);
    }
    query += ' ORDER BY label ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET ADDRESSES ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
};

// POST /api/addresses — add new address
exports.createAddress = async (req, res) => {
  try {
    const {
      company_name, label, type, contact_name,
      phone, email, address_1, suburb, city,
      postal_code, country, country_code
    } = req.body;

    const result = await db.query(`
      INSERT INTO client_addresses
        (company_name, label, type, contact_name, phone, email,
         address_1, suburb, city, postal_code, country, country_code)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [company_name, label, type || 'both', contact_name || '',
       phone || '', email || '', address_1 || '', suburb || '',
       city || '', postal_code || '',
       country || 'South Africa', country_code || 'ZA']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('CREATE ADDRESS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to create address' });
  }
};

// PUT /api/addresses/:id — update address
exports.updateAddress = async (req, res) => {
  try {
    const {
      company_name, label, type, contact_name,
      phone, email, address_1, suburb, city,
      postal_code, country, country_code
    } = req.body;

    const result = await db.query(`
      UPDATE client_addresses SET
        company_name=$1, label=$2, type=$3, contact_name=$4,
        phone=$5, email=$6, address_1=$7, suburb=$8,
        city=$9, postal_code=$10, country=$11, country_code=$12
      WHERE id=$13 RETURNING *`,
      [company_name, label, type, contact_name,
       phone, email, address_1, suburb,
       city, postal_code, country, country_code,
       req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('UPDATE ADDRESS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to update address' });
  }
};

// DELETE /api/addresses/:id
exports.deleteAddress = async (req, res) => {
  try {
    await db.query('DELETE FROM client_addresses WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE ADDRESS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to delete address' });
  }
};




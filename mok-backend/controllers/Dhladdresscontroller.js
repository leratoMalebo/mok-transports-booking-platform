const db = require('../db');

exports.getCompanies = async (req, res) => {
  try {
    const result = await db.query(`SELECT DISTINCT
company_name,
city,
country_code
FROM dhl_addresses
ORDER BY company_name;`);
    res.json(result.rows.map(r => r.company_name));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAddresses = async (req, res) => {
  try {
    const { company } = req.query;
    let query = `SELECT * FROM dhl_addresses WHERE 1=1`;
    const params = [];
    if (company) { query += ` AND LOWER(company_name) ILIKE $1`; params.push(`%${company.toLowerCase()}%`); }
    query += ' ORDER BY company_name, city ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createAddress = async (req, res) => {
  try {
    const { company_name, contact_name, email, phone, country, country_code, address_1, address_2, postal_code, city, suburb, province } = req.body;
    const result = await db.query(`INSERT INTO dhl_addresses (company_name,contact_name,email,phone,country,country_code,address_1,address_2,postal_code,city,suburb,province) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [company_name, contact_name || '', email || '', phone || '', country || '', country_code || '', address_1 || '', address_2 || '', postal_code || '', city || '', suburb || '', province || '']);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateAddress = async (req, res) => {
  try {
    const { company_name, contact_name, email, phone, country, country_code, address_1, address_2, postal_code, city, suburb, province } = req.body;
    const result = await db.query(
      `UPDATE dhl_addresses SET
        company_name=$1, contact_name=$2, email=$3, phone=$4, country=$5, country_code=$6,
        address_1=$7, address_2=$8, postal_code=$9, city=$10, suburb=$11, province=$12
       WHERE id=$13 RETURNING *`,
      [company_name, contact_name || '', email || '', phone || '', country || '', country_code || '', address_1 || '', address_2 || '', postal_code || '', city || '', suburb || '', province || '', req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Address not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteAddress = async (req, res) => {
  try {
    await db.query('DELETE FROM dhl_addresses WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};





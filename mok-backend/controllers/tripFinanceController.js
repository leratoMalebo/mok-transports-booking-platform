// mok-backend/controllers/tripFinanceController.js
// One small controller for: trip calculator saves, fleet maintenance, driver trips and fuel fills.
const db = require('../db');

const TABLES = {
  'trip-calcs':   { table: 'trip_calcs',        cols: ['name','km','revenue','cost','profit','margin','inputs','created_by'] },
  'maintenance':  { table: 'fleet_maintenance', cols: ['truck','service_date','type','odometer','cost','next_km','note'] },
  'driver-trips': { table: 'driver_trips',      cols: ['trip_date','driver_name','vehicle_reg','vehicle_type','origin','destination','company','booking_ref','cargo','odo_start','odo_end','remuneration','tolls','meals','accommodation','border_customs','other_costs','revenue','notes','created_by'] },
  'fuel-fills':   { table: 'fuel_fills',        cols: ['fill_date','vehicle_reg','driver_name','trip_id','litres','price_per_litre','total_cost','odometer','station','receipt_no','notes'] },
};

exports.list = async (req, res) => {
  const t = TABLES[req.params.resource];
  if (!t) return res.status(404).json({ error: 'Unknown resource' });
  try {
    const r = await db.query(`SELECT * FROM ${t.table} ORDER BY created_at DESC LIMIT 3000`);
    res.json(r.rows);
  } catch (e) { console.error('TRIP FINANCE LIST', e.message); res.status(500).json({ error: 'Failed to load records' }); }
};

exports.create = async (req, res) => {
  const t = TABLES[req.params.resource];
  if (!t) return res.status(404).json({ error: 'Unknown resource' });
  try {
    const keys = t.cols.filter(c => req.body[c] !== undefined && req.body[c] !== '' && req.body[c] !== null);
    if (!keys.length) return res.status(400).json({ error: 'Nothing to save' });
    const r = await db.query(
      `INSERT INTO ${t.table} (${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`,
      keys.map(k => req.body[k]));
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error('TRIP FINANCE CREATE', e.message); res.status(500).json({ error: 'Failed to save record' }); }
};

exports.remove = async (req, res) => {
  const t = TABLES[req.params.resource];
  if (!t) return res.status(404).json({ error: 'Unknown resource' });
  try {
    await db.query(`DELETE FROM ${t.table} WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error('TRIP FINANCE DELETE', e.message); res.status(500).json({ error: 'Failed to delete record' }); }
};


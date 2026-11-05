// mok-backend/controllers/hrController.js — HR trial module
// All timestamps come from the SERVER clock, never the browser.
const db = require('../db');
const TODAY = `(NOW() AT TIME ZONE 'Africa/Johannesburg')::date`;
const fail = (res, e, msg) => { console.error('HR:', e.message); res.status(500).json({ error: msg }); };

async function openRecord(userId) {
  const r = await db.query(`SELECT * FROM hr_attendance WHERE user_id=$1 AND work_date=${TODAY} AND clock_out IS NULL`, [userId]);
  return r.rows[0];
}

exports.clockIn = async (req, res) => {
  try {
    const { user_id, user_name } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    if (await openRecord(user_id)) return res.status(409).json({ error: 'Already clocked in.' });
    const r = await db.query(`INSERT INTO hr_attendance (user_id,user_name,work_date) VALUES ($1,$2,${TODAY}) RETURNING *`, [user_id, user_name || '']);
    res.status(201).json(r.rows[0]);
  } catch (e) { fail(res, e, 'Clock in failed'); }
};

exports.clockOut = async (req, res) => {
  try {
    const rec = await openRecord(req.body.user_id);
    if (!rec) return res.status(409).json({ error: 'Not clocked in.' });
    await db.query(`UPDATE hr_breaks SET break_end=NOW() WHERE attendance_id=$1 AND break_end IS NULL`, [rec.id]);
    const r = await db.query(`UPDATE hr_attendance SET clock_out=NOW() WHERE id=$1 RETURNING *`, [rec.id]);
    res.json(r.rows[0]);
  } catch (e) { fail(res, e, 'Clock out failed'); }
};

exports.breakStart = async (req, res) => {
  try {
    const rec = await openRecord(req.body.user_id);
    if (!rec) return res.status(409).json({ error: 'Clock in first.' });
    const open = await db.query(`SELECT id FROM hr_breaks WHERE attendance_id=$1 AND break_end IS NULL`, [rec.id]);
    if (open.rows.length) return res.status(409).json({ error: 'Already on break.' });
    const r = await db.query(`INSERT INTO hr_breaks (attendance_id,break_type) VALUES ($1,$2) RETURNING *`, [rec.id, req.body.break_type || 'Lunch']);
    res.status(201).json(r.rows[0]);
  } catch (e) { fail(res, e, 'Could not start break'); }
};

exports.breakEnd = async (req, res) => {
  try {
    const rec = await openRecord(req.body.user_id);
    if (!rec) return res.status(409).json({ error: 'Not clocked in.' });
    const r = await db.query(`UPDATE hr_breaks SET break_end=NOW() WHERE attendance_id=$1 AND break_end IS NULL RETURNING *`, [rec.id]);
    if (!r.rows.length) return res.status(409).json({ error: 'No active break.' });
    res.json(r.rows[0]);
  } catch (e) { fail(res, e, 'Could not end break'); }
};

exports.today = async (req, res) => {
  try {
    const a = await db.query(`SELECT * FROM hr_attendance WHERE user_id=$1 AND work_date=${TODAY} ORDER BY clock_in DESC LIMIT 1`, [req.params.userId]);
    const rec = a.rows[0] || null;
    const b = rec ? (await db.query(`SELECT * FROM hr_breaks WHERE attendance_id=$1 ORDER BY break_start`, [rec.id])).rows : [];
    res.json({ server_now: new Date().toISOString(), attendance: rec, breaks: b });
  } catch (e) { fail(res, e, 'Could not load today'); }
};

exports.history = async (req, res) => {
  try {
    const r = await db.query(`
      SELECT a.id, a.work_date, a.clock_in, a.clock_out,
        COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(b.break_end,NOW())-b.break_start)))/60 FROM hr_breaks b WHERE b.attendance_id=a.id),0)::int AS break_min,
        (EXTRACT(EPOCH FROM (COALESCE(a.clock_out,NOW())-a.clock_in))/60)::int AS span_min
      FROM hr_attendance a WHERE a.user_id=$1 ORDER BY a.clock_in DESC LIMIT 30`, [req.params.userId]);
    res.json(r.rows);
  } catch (e) { fail(res, e, 'Could not load history'); }
};

exports.team = async (req, res) => {
  try {
    const r = await db.query(`
      SELECT u.id, u.name, a.clock_in, a.clock_out,
        EXISTS(SELECT 1 FROM hr_breaks b WHERE b.attendance_id=a.id AND b.break_end IS NULL) AS on_break
      FROM users u LEFT JOIN hr_attendance a ON a.user_id=u.id AND a.work_date=${TODAY}
      WHERE u.role IN ('staff','admin') AND COALESCE(u.is_active,TRUE)
      ORDER BY u.name`);
    res.json(r.rows);
  } catch (e) { fail(res, e, 'Could not load team'); }
};

exports.addNote = async (req, res) => {
  try {
    const { user_id, user_name, date_from, date_to, reason, file_name, file_mime, file_b64 } = req.body;
    if (!user_id || !date_from || !date_to) return res.status(400).json({ error: 'Dates required.' });
    if (file_b64 && file_b64.length > 4_000_000) return res.status(413).json({ error: 'File too large (max 3MB).' });
    const r = await db.query(`INSERT INTO hr_notes (user_id,user_name,date_from,date_to,reason,file_name,file_mime,file_b64)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status,created_at`,
      [user_id, user_name || '', date_from, date_to, reason || '', file_name || null, file_mime || null, file_b64 || null]);
    res.status(201).json(r.rows[0]);
  } catch (e) { fail(res, e, 'Could not save note'); }
};

exports.listNotes = async (req, res) => {
  try {
    const { user_id } = req.query;
    const r = await db.query(`SELECT id,user_id,user_name,date_from,date_to,reason,file_name,status,reviewed_by,created_at
      FROM hr_notes ${user_id ? 'WHERE user_id=$1' : ''} ORDER BY created_at DESC LIMIT 100`, user_id ? [user_id] : []);
    res.json(r.rows);
  } catch (e) { fail(res, e, 'Could not load notes'); }
};

exports.noteFile = async (req, res) => {
  try {
    const r = await db.query(`SELECT file_name,file_mime,file_b64 FROM hr_notes WHERE id=$1`, [req.params.id]);
    if (!r.rows.length || !r.rows[0].file_b64) return res.status(404).json({ error: 'No file.' });
    res.json(r.rows[0]);
  } catch (e) { fail(res, e, 'Could not load file'); }
};

exports.reviewNote = async (req, res) => {
  try {
    const { status, reviewed_by } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const r = await db.query(`UPDATE hr_notes SET status=$1,reviewed_by=$2,reviewed_at=NOW() WHERE id=$3 RETURNING id,status`, [status, reviewed_by || '', req.params.id]);
    res.json(r.rows[0] || {});
  } catch (e) { fail(res, e, 'Could not update note'); }
};


// mok-backend/routes/hr.js
const router = require('express').Router();
const c = require('../controllers/hrController');
router.post('/clock-in', c.clockIn);
router.post('/clock-out', c.clockOut);
router.post('/break/start', c.breakStart);
router.post('/break/end', c.breakEnd);
router.get('/today/:userId', c.today);
router.get('/history/:userId', c.history);
router.get('/team', c.team);
router.post('/notes', c.addNote);
router.get('/notes', c.listNotes);
router.get('/notes/:id/file', c.noteFile);
router.patch('/notes/:id', c.reviewNote);
module.exports = router;



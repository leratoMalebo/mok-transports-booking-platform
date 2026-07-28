const express = require('express');
const router  = express.Router();
// ✅ To match the exact casing of your file:
const c = require('../controllers/Dhladdresscontroller');

router.get('/companies', c.getCompanies);
router.get('/',          c.getAddresses);
router.post('/',         c.createAddress);
router.delete('/:id',    c.deleteAddress);

module.exports = router;











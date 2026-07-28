const express = require('express');
const router  = express.Router();
const c       = require('../controllers/dhlAddressController');

router.get('/companies', c.getCompanies);
router.get('/',          c.getAddresses);
router.post('/',         c.createAddress);
router.delete('/:id',    c.deleteAddress);

module.exports = router;








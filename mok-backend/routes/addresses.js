const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/addressController');

router.get('/companies', controller.getCompanies);
router.get('/',          controller.getAddresses);
router.post('/',         controller.createAddress);
router.put('/:id',       controller.updateAddress);
router.delete('/:id',    controller.deleteAddress);

module.exports = router;




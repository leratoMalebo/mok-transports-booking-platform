const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/truckInvoiceController');

router.get('/',                          controller.getAllInvoices);
router.get('/booking/:ref',              controller.getInvoiceByBooking);
router.get('/:invoiceNo',                controller.getInvoice);
router.post('/',                         controller.createInvoice);
router.patch('/:invoiceNo/mark-paid',    controller.markPaid);
router.patch('/:invoiceNo/reference',    controller.updateReference);
router.patch('/:invoiceNo/charges',      controller.updateCharges);
router.patch('/:invoiceNo/details',      controller.updateDetails);

module.exports = router;








const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/truckInvoiceController');

router.get('/',                          controller.getAllInvoices);
router.get('/booking/:ref',              controller.getInvoiceByBooking);
router.get('/:invoiceNo',                controller.getInvoice);
router.post('/',                         controller.createInvoice);
router.patch('/:invoiceNo/mark-paid',    controller.markPaid);
router.patch('/:invoiceNo/reference',    controller.updateReference);

module.exports = router;



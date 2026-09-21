const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/dhlInvoiceController');

router.get('/',                              controller.getAllInvoices);
router.get('/uninvoiced/:clientId',          controller.getUninvoicedShipments);
router.get('/:invoiceNo',                    controller.getInvoice);
router.post('/',                             controller.createInvoice);
router.patch('/:invoiceNo/mark-paid',        controller.markPaid);
router.patch('/:invoiceNo/reference',        controller.updateReference);
router.patch('/:invoiceNo/details',          controller.updateDetails);

module.exports = router;



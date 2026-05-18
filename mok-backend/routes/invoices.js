const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/invoiceController');

// IMPORTANT: specific routes must come before /:id
router.get('/clients-with-waybills',       controller.getClientsWithWaybills);
router.get('/uninvoiced/:clientId',        controller.getUninvoicedWaybills);
router.get('/client/:clientId',            controller.getClientInvoices);
router.get('/',                            controller.getInvoices);
router.get('/:id',                         controller.getInvoiceById);

router.post('/grouped',                    controller.createGroupedInvoice);
router.post('/',                           controller.createInvoice);

router.patch('/:invoiceNo/mark-paid',      controller.markPaid);

module.exports = router;



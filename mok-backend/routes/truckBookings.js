const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/truckBookingController');

router.get('/',                              controller.getAllBookings);
router.get('/:ref',                          controller.getBooking);
router.post('/',                             controller.createBooking);
router.patch('/:ref/status',                 controller.updateStatus);
router.patch('/:ref/pickup-signature',       controller.savePickupSignature);
router.patch('/:ref/delivery-signature',     controller.saveDeliverySignature);
router.patch('/:ref', truckBookingController.updateBooking);
router.patch('/:ref/mark-invoiced',          controller.markInvoiced);
router.patch('/:ref/notes',                  controller.updateNotes);

module.exports = router;



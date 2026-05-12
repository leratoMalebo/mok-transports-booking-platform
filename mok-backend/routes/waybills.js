const express = require('express');
const router = express.Router();
const controller = require('../controllers/waybillController');

router.post('/', controller.createWaybill);
router.get('/', controller.getWaybills);
router.get('/search', controller.searchWaybills);
// GET SINGLE WAYBILL
router.get('/:waybillNo', controller.getWaybillByNumber);
router.post('/:waybillNo/send-to-jkj', controller.sendToJKJ);

module.exports = router;


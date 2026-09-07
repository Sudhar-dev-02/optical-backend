const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');

// Bill Endpoints
router.get('/next-number', billController.getNextBillNo);
router.get('/', billController.getBills);
router.get('/:id', billController.getBillById);
router.post('/', billController.createBill);
router.put('/:id', billController.updateBill);
router.delete('/:id', billController.deleteBill);
router.patch('/:id/delivery', billController.updateDeliveryStatus);
router.post('/:id/send-sms', billController.sendSMS);

module.exports = router;

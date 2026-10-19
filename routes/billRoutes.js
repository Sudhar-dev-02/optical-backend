const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { validateBillInput, validateIdParam } = require('../middleware/validate');
const { writeLimiter } = require('../middleware/rateLimiter');

// Bill Endpoints
router.get('/next-number', billController.getNextBillNo);
router.get('/', billController.getBills);
router.get('/:id', validateIdParam, billController.getBillById);
router.post('/', writeLimiter, validateBillInput, billController.createBill);
router.put('/:id', writeLimiter, validateIdParam, validateBillInput, billController.updateBill);
router.delete('/:id', writeLimiter, validateIdParam, billController.deleteBill);
router.patch('/:id/delivery', writeLimiter, validateIdParam, billController.updateDeliveryStatus);
router.patch('/:id/followup', writeLimiter, validateIdParam, billController.updateFollowUpStatus);
router.patch('/:id/toggle-sms', writeLimiter, validateIdParam, billController.toggleReminderSent);
router.post('/:id/send-sms', writeLimiter, validateIdParam, billController.sendSMS);

module.exports = router;

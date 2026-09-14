const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// Customer Endpoints
router.get('/', customerController.getCustomers);
router.get('/lookup/:query', customerController.lookupCustomer);

module.exports = router;

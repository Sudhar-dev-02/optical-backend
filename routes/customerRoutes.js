const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { validateQueryParam } = require('../middleware/validate');

// Customer Endpoints
router.get('/', customerController.getCustomers);
router.get('/lookup/:query', validateQueryParam, customerController.lookupCustomer);

module.exports = router;

const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');
const { writeLimiter } = require('../middleware/rateLimiter');

router.get('/', catalogController.getCatalog);
router.post('/', writeLimiter, catalogController.updateCatalog);
router.put('/', writeLimiter, catalogController.updateCatalog);

module.exports = router;

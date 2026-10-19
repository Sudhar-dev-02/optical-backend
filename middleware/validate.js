/**
 * Input Validation & Sanitization Helpers
 */

/**
 * Escapes characters with special meaning in regular expressions.
 * Prevents ReDoS attacks and RegExp syntax errors when querying with user input.
 */
const escapeRegExp = (string) => {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Validate bill creation payload
 */
const validateBillInput = (req, res, next) => {
  const { customer, netAmount, totalAmount } = req.body;

  if (customer) {
    if (typeof customer.name === 'string' && customer.name.length > 200) {
      return res.status(400).json({ success: false, message: 'Customer name is too long (max 200 characters).' });
    }
    if (typeof customer.phone === 'string' && customer.phone.length > 50) {
      return res.status(400).json({ success: false, message: 'Customer phone number is invalid.' });
    }
  }

  if (netAmount !== undefined && (isNaN(Number(netAmount)) || Number(netAmount) < 0)) {
    return res.status(400).json({ success: false, message: 'Invalid net amount.' });
  }

  if (totalAmount !== undefined && (isNaN(Number(totalAmount)) || Number(totalAmount) < 0)) {
    return res.status(400).json({ success: false, message: 'Invalid total amount.' });
  }

  next();
};

/**
 * Validate ID parameter (ensure valid format or string)
 */
const validateIdParam = (req, res, next) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid or missing ID parameter.' });
  }
  next();
};

/**
 * Validate query parameter for routes like /lookup/:query
 */
const validateQueryParam = (req, res, next) => {
  const { query } = req.params;
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid or missing query parameter.' });
  }
  next();
};

module.exports = {
  escapeRegExp,
  validateBillInput,
  validateIdParam,
  validateQueryParam
};

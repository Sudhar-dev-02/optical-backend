const rateLimit = require('express-rate-limit');

/**
 * Standard API rate limiter to protect against DoS and abusive scraping
 * Allows 200 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 10000 : 200, // higher limit in tests
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

/**
 * Write operations rate limiter (POST/PUT/DELETE)
 * Allows 100 writes per 15 minutes per IP
 */
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many write requests from this IP, please try again later.'
  }
});

module.exports = {
  apiLimiter,
  writeLimiter
};

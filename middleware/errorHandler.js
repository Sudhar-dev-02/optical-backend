// Centralized Error Handling & Not Found Middleware

/**
 * Handle 404 for undefined routes
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
};

/**
 * Global Error Handler
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  
  // Log error internally for debugging
  console.error(`[Error] ${req.method} ${req.originalUrl} - ${err.message}`, err.stack ? err.stack.split('\n')[1] : '');

  res.status(statusCode).json({
    success: false,
    message: err.isOperational ? err.message : (process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : err.message),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};

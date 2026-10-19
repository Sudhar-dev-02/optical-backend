const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const connectDB = require('./config/db');
const billRoutes = require('./routes/billRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const customerRoutes = require('./routes/customerRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'https://sudhar-dev-02.github.io'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or Postman) or matched origins
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for this origin'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Request Body Parsing with strict size limits to prevent Denial of Service
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Apply Rate Limiter to all API routes
app.use('/api', apiLimiter);

// Health Check & System Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'OPTICS INDIA Billing API',
    uptime: Math.floor(process.uptime()),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'hybrid_in_memory_fallback',
    timestamp: new Date()
  });
});

// Mount Routes
app.use('/api/bills', billRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/customers', customerRoutes);

// Catch 404 for undefined routes
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// Start Server & DB connection
let server = null;

const startServer = async () => {
  await connectDB();
  server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Optics India Billing Server running on port ${PORT}`);
    console.log(`📍 API Base: http://localhost:${PORT}/api/bills`);
    console.log(`🛡️  Security Headers & Rate Limiting Enabled`);
    console.log(`====================================================`);
  });
};

// Graceful Shutdown Handler
const gracefulShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close(false);
        console.log('[MongoDB] Connection closed cleanly.');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;

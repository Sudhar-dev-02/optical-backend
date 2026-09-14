const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const connectDB = require('./config/db');
const billRoutes = require('./routes/billRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const customerRoutes = require('./routes/customerRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/bills', billRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/customers', customerRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'OPTICS INDIA Billing API',
    timestamp: new Date()
  });
});

// Start Server & DB connection
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Optics India Billing Server running on port ${PORT}`);
    console.log(`📍 API Base: http://localhost:${PORT}/api/bills`);
    console.log(`====================================================`);
  });
};

startServer();

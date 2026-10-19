const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    const connStr = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/optics_india';
    
    // Configure production-ready connection options
    const conn = await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 5000, // 5s timeout if database is unreachable
      maxPoolSize: 10,                 // Maintain up to 10 socket connections
      minPoolSize: 2,                  // Minimum connections in pool
      socketTimeoutMS: 45000,          // Close sockets after 45 seconds of inactivity
      autoIndex: process.env.NODE_ENV !== 'production' // Build indexes in dev/test, manage in prod
    });

    isConnected = true;
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error(`[MongoDB Error] Connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('[MongoDB Warning] Disconnected. Running in hybrid/memory fallback mode.');
    });

    mongoose.connection.on('reconnected', () => {
      isConnected = true;
      console.log('[MongoDB] Reconnected successfully.');
    });

    return true;
  } catch (error) {
    isConnected = false;
    console.warn(`[MongoDB Warning] Could not connect to MongoDB database (${error.message}).`);
    console.warn(`[MongoDB Warning] Operating with hybrid storage / memory fallback if database is offline.`);
    return false;
  }
};

module.exports = connectDB;

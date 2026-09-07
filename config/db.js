const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const connStr = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/optics_india';
    const conn = await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 3000 // Quick timeout if local mongo isn't running
    });
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.warn(`[MongoDB Warning] Could not connect to MongoDB database (${error.message}).`);
    console.warn(`[MongoDB Warning] Operating with hybrid storage / memory fallback if database is offline.`);
    return false;
  }
};

module.exports = connectDB;

const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  mrdNo: { type: String, default: '' },
  name: { type: String, required: true },
  phone: { type: String, required: true, index: true },
  address: { type: String, default: '' },
  age: { type: Number, default: 0 },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
  orderTakenBy: { type: String, default: 'babu' }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);

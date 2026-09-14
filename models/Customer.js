const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  mrdNo: { type: String, default: '' },
  name: { type: String, required: true },
  phone: { type: String, required: true, index: true },
  address: { type: String, default: '' },
  age: { type: Number, default: 0 },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
  orderTakenBy: { type: String, default: 'babu' },
  walletBalance: { type: Number, default: 0 },
  referredByMrd: { type: String, default: '' },
  referralCount: { type: Number, default: 0 },
  walletHistory: [{
    amount: Number,
    type: { type: String, enum: ['EARNED', 'REDEEMED', 'REFERRAL_BONUS'] },
    billNo: Number,
    note: String,
    date: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);

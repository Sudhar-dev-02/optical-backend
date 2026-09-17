const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  billNo: { type: Number, required: true, unique: true, index: true },
  entryType: { type: String, enum: ['New', 'Repeat', 'Warranty'], default: 'New' },
  date: { type: Date, default: Date.now },
  
  // Customer Details
  customer: {
    mrdNo: String,
    name: String,
    phone: String,
    address: String,
    age: Number,
    gender: String,
    drName: String,
    orderTakenBy: String,
    note: String
  },

  // Optical Prescription Parameters
  prescription: {
    rightEye: {
      sph: { type: String, default: 'plano' },
      cyl: { type: String, default: '-' },
      axis: { type: String, default: '-' },
      add: { type: String, default: '-' },
      va: { type: String, default: '6/6' }
    },
    leftEye: {
      sph: { type: String, default: 'plano' },
      cyl: { type: String, default: '-' },
      axis: { type: String, default: '-' },
      add: { type: String, default: '-' },
      va: { type: String, default: '6/6' }
    },
    pd: { type: String, default: '' },
    ri: { type: String, default: '1.56' }
  },

  // Items Purchased
  lens: {
    type: { type: String, default: 'SV' },
    coating: { type: String, default: 'HMC' },
    brand: { type: String, default: 'essilor' },
    warranty: { type: String, default: 'NIL' },
    qty: { type: Number, default: 1 },
    price: { type: Number, default: 1000 }
  },
  frame: {
    type: { type: String, default: 'Full frame' },
    brand: { type: String, default: 'Titan' },
    warranty: { type: String, default: '1 year' },
    qty: { type: Number, default: 1 },
    price: { type: Number, default: 500 }
  },


  // Financial Calculations
  totalAmount: { type: Number, default: 1500 },
  discountAmount: { type: Number, default: 100 },
  referralDiscount: { type: Number, default: 0 },
  netAmount: { type: Number, default: 1400 },
  payMode: { type: String, enum: ['CASH', 'CARD', 'UPI', 'ONLINE', 'BANK_TRANSFER'], default: 'CASH' },
  onlinePayAmount: { type: Number, default: 0 },
  advanceAmount: { type: Number, default: 1000 },
  balanceAmount: { type: Number, default: 400 },
  
  // Wallet & Referral Tracking
  referrerMrd: { type: String, default: '' },
  referrerPhone: { type: String, default: '' },
  referrerName: { type: String, default: '' },
  walletRedeemed: { type: Number, default: 0 },
  cashbackEarned: { type: Number, default: 0 },

  // Logistics
  deliveryDate: { type: Date },
  reminderDate: { type: Date },
  deliveryStatus: { type: String, enum: ['Pending', 'Ready', 'Delivered'], default: 'Pending' },

  smsSent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Bill', billSchema);

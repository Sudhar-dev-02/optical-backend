const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const mongoose = require('mongoose');
const { escapeRegExp } = require('../middleware/validate');

// Helper to check MongoDB connection
const isMongoConnected = () => mongoose.connection.readyState === 1;

// In-Memory store for customers fallback
let inMemoryCustomers = [
  {
    _id: 'cust_1',
    mrdNo: '00003',
    name: 'abrar',
    phone: '7339334042',
    address: 'tvm',
    age: 26,
    gender: 'Male',
    walletBalance: 280,
    referralCount: 1,
    walletHistory: [
      { amount: 280, type: 'EARNED', billNo: '001', note: '10% Cashback on Bill #001', date: new Date() }
    ]
  },
  {
    _id: 'cust_2',
    mrdNo: '03380',
    name: 'MUJEEB',
    phone: '9952417748',
    address: 'Chennai',
    age: 34,
    gender: 'Male',
    walletBalance: 150,
    referralCount: 0,
    walletHistory: []
  }
];

// Lookup Customer by MRD No or Phone for Referral
exports.lookupCustomer = async (req, res, next) => {
  try {
    const { query } = req.params;
    if (!query) return res.status(400).json({ success: false, message: 'Search query is required' });

    const q = String(query).trim().toLowerCase();
    const cleanNum = q.replace(/^0+/, ''); // e.g. "00480" -> "480"
    const safeCleanNum = escapeRegExp(cleanNum);
    const safeQ = escapeRegExp(q);

    if (isMongoConnected()) {
      // 1. Try exact/padded MRD match first
      let customer = await Customer.findOne({
        mrdNo: { $regex: new RegExp(`^0*${safeCleanNum}$`, 'i') }
      }).lean();

      // 2. If no MRD match and query is 7+ digits, try phone lookup
      if (!customer && q.length >= 7) {
        customer = await Customer.findOne({
          phone: { $regex: new RegExp(safeQ, 'i') }
        }).lean();
      }

      if (!customer) {
        // Fallback: search Bill collection for customer details
        let bill = await Bill.findOne({
          'customer.mrdNo': { $regex: new RegExp(`^0*${safeCleanNum}$`, 'i') }
        }).lean();

        if (!bill && q.length >= 7) {
          bill = await Bill.findOne({
            'customer.phone': { $regex: new RegExp(safeQ, 'i') }
          }).lean();
        }

        if (bill && bill.customer) {
          const custMrd = bill.customer.mrdNo || '';
          const custPhone = bill.customer.phone || '';
          const custBills = await Bill.find({
            $or: [
              { 'customer.mrdNo': custMrd },
              { 'customer.phone': custPhone }
            ]
          }, { cashbackEarned: 1, walletRedeemed: 1 }).lean();

          let bal = 0;
          custBills.forEach(b => {
            bal += (Number(b.cashbackEarned) || 0) - (Number(b.walletRedeemed) || 0);
          });

          const refBills = await Bill.find({
            $or: [
              { referrerMrd: custMrd },
              { referrerPhone: custPhone }
            ]
          }, { netAmount: 1 }).lean();

          refBills.forEach(b => {
            bal += Math.round((Number(b.netAmount) || 0) * 0.10);
          });

          customer = {
            mrdNo: bill.customer.mrdNo,
            name: bill.customer.name,
            phone: bill.customer.phone,
            address: bill.customer.address,
            walletBalance: Math.max(0, bal)
          };
        }
      }

      if (!customer) {
        return res.json(null);
      }

      return res.json(customer);
    } else {
      // In-Memory lookup: MRD first, phone only if 7+ digits
      let customer = inMemoryCustomers.find(c => {
        const cMrd = (c.mrdNo || '').toLowerCase().replace(/^0+/, '');
        return cMrd && cMrd === cleanNum;
      });

      if (!customer && q.length >= 7) {
        customer = inMemoryCustomers.find(c => c.phone && c.phone.includes(q));
      }

      if (!customer) {
        return res.json(null);
      }

      return res.json(customer);
    }
  } catch (error) {
    next(error);
  }
};

// Get All Customers or Search by query (?query=...)
exports.getCustomers = async (req, res, next) => {
  try {
    const { query, search, limit = 1000 } = req.query;
    const q = (query || search || '').trim().toLowerCase();
    const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 500), 2000);

    if (q) {
      const cleanNum = q.replace(/^0+/, '');
      const safeCleanNum = escapeRegExp(cleanNum);
      const safeQ = escapeRegExp(q);

      if (isMongoConnected()) {
        let match = await Customer.findOne({ mrdNo: { $regex: new RegExp(`^0*${safeCleanNum}$`, 'i') } }).lean();
        if (!match && q.length >= 7) {
          match = await Customer.findOne({ phone: { $regex: new RegExp(safeQ, 'i') } }).lean();
        }
        return res.json(match ? [match] : []);
      } else {
        let match = inMemoryCustomers.find(c => {
          const cMrd = (c.mrdNo || '').toLowerCase().replace(/^0+/, '');
          return cMrd && cMrd === cleanNum;
        });
        if (!match && q.length >= 7) {
          match = inMemoryCustomers.find(c => c.phone && c.phone.includes(q));
        }
        return res.json(match ? [match] : []);
      }
    }

    if (isMongoConnected()) {
      const customers = await Customer.find()
        .sort({ createdAt: -1 })
        .limit(maxLimit)
        .lean();
      return res.json(customers);
    } else {
      return res.json(inMemoryCustomers.slice(0, maxLimit));
    }
  } catch (error) {
    next(error);
  }
};

// Export in-memory customers helper for bill controller fallback
exports.inMemoryCustomers = inMemoryCustomers;

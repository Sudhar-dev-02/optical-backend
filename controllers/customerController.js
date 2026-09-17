const Customer = require('../models/Customer');
const mongoose = require('mongoose');

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
      { amount: 280, type: 'EARNED', billNo: 6852, note: '10% Cashback on Bill #6852', date: new Date() }
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

const Bill = require('../models/Bill');

// Lookup Customer by MRD No or Phone for Referral
exports.lookupCustomer = async (req, res) => {
  try {
    const { query } = req.params;
    if (!query) return res.status(400).json({ message: 'Search query is required' });

    const q = query.trim().toLowerCase();
    const cleanNum = q.replace(/^0+/, ''); // e.g. "00480" -> "480"

    if (isMongoConnected()) {
      // 1. Try exact/padded MRD match first
      let customer = await Customer.findOne({
        mrdNo: { $regex: new RegExp(`^0*${cleanNum}$`, 'i') }
      });

      // 2. If no MRD match and query is 7+ digits, try phone lookup
      if (!customer && q.length >= 7) {
        customer = await Customer.findOne({
          phone: { $regex: new RegExp(q, 'i') }
        });
      }

      if (!customer) {
        // Fallback: search Bill collection for customer details
        let bill = await Bill.findOne({
          'customer.mrdNo': { $regex: new RegExp(`^0*${cleanNum}$`, 'i') }
        });

        if (!bill && q.length >= 7) {
          bill = await Bill.findOne({
            'customer.phone': { $regex: new RegExp(q, 'i') }
          });
        }

        if (bill && bill.customer) {
          customer = {
            mrdNo: bill.customer.mrdNo,
            name: bill.customer.name,
            phone: bill.customer.phone,
            address: bill.customer.address,
            walletBalance: 280
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
    res.status(500).json({ error: error.message });
  }
};

// Get All Customers or Search by query (?query=...)
exports.getCustomers = async (req, res) => {
  try {
    const { query, search } = req.query;
    const q = (query || search || '').trim().toLowerCase();

    if (q) {
      const cleanNum = q.replace(/^0+/, '');
      if (isMongoConnected()) {
        let match = await Customer.findOne({ mrdNo: { $regex: new RegExp(`^0*${cleanNum}$`, 'i') } });
        if (!match && q.length >= 7) {
          match = await Customer.findOne({ phone: { $regex: new RegExp(q, 'i') } });
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
      const customers = await Customer.find().sort({ createdAt: -1 });
      return res.json(customers);
    } else {
      return res.json(inMemoryCustomers);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Export in-memory customers helper for bill controller fallback
exports.inMemoryCustomers = inMemoryCustomers;

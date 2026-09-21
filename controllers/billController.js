const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const mongoose = require('mongoose');

// In-Memory fallback store for demo & fallback when Mongo DB is offline
let inMemoryBills = [
  {
    _id: 'bill_6852',
    billNo: 6852,
    entryType: 'New',
    date: new Date('2026-07-07'),
    customer: {
      mrdNo: '00003',
      name: 'abrar',
      phone: '7339334042',
      address: 'tvm',
      age: 26,
      gender: 'Male',
      drName: 'Bushra',
      orderTakenBy: 'Babu',
      note: '50 %'
    },
    prescription: {
      rightEye: { sph: 'plano', cyl: '-', axis: '-', add: '-', va: '6/6' },
      leftEye: { sph: 'plano', cyl: '-', axis: '-', add: '-', va: '6/6' },
      pd: '62',
      ri: '1.56'
    },
    lens: { type: 'SV', coating: 'HMC', brand: 'essilor', warranty: '1 year', qty: 1, price: 1000 },
    frame: { type: 'Full frame', brand: 'Titan', warranty: '1 year', qty: 1, price: 500 },
    totalAmount: 1500,
    discountAmount: 100,
    netAmount: 1400,
    payMode: 'CASH',
    onlinePayAmount: 0,
    advanceAmount: 1000,
    balanceAmount: 400,
    deliveryDate: new Date('2026-07-07'),
    reminderDate: new Date('2026-07-07'),
    deliveryStatus: 'Pending',
    smsSent: false
  },
  {
    _id: 'bill_6853',
    billNo: 6853,
    entryType: 'New',
    date: new Date('2026-07-01'),
    customer: {
      mrdNo: '00003',
      name: 'abrar',
      phone: '7339334042',
      address: 'tvm',
      age: 26,
      gender: 'Male',
      drName: 'Janani',
      orderTakenBy: 'Abrar',
      note: ''
    },
    prescription: {
      rightEye: { sph: '-1.00', cyl: '-', axis: '-', add: '-', va: '6/6' },
      leftEye: { sph: '-1.00', cyl: '-', axis: '-', add: '-', va: '6/6' },
      pd: '64',
      ri: '1.6'
    },
    lens: { type: 'Bifocal', coating: 'Bluecut', brand: 'crizal', warranty: '6 months', qty: 1, price: 500 },
    frame: { type: 'Full frame', brand: 'Titan', warranty: '1 year', qty: 1, price: 300 },
    totalAmount: 800,
    discountAmount: 0,
    netAmount: 800,
    payMode: 'CASH',
    onlinePayAmount: 0,
    advanceAmount: 800,
    balanceAmount: 0,
    deliveryDate: new Date('2026-07-01'),
    reminderDate: new Date('2026-07-01'),
    deliveryStatus: 'Delivered',
    smsSent: true
  },
  {
    _id: 'bill_6873',
    billNo: 6873,
    entryType: 'New',
    date: new Date('2026-06-29'),
    customer: {
      mrdNo: '03380',
      name: 'MUJEEB',
      phone: '7339334042',
      address: 'Chennai',
      age: 34,
      gender: 'Male',
      drName: 'Aravint Hsptl',
      orderTakenBy: 'Arafath',
      note: 'Rush delivery'
    },
    prescription: {
      rightEye: { sph: '-1.75', cyl: '-1.25', axis: '150', add: '+1.50', va: '6/6' },
      leftEye: { sph: '-2.00', cyl: '-1.25', axis: '30', add: '+1.50', va: '6/6' },
      pd: '66',
      ri: '1.74'
    },
    lens: { type: 'Progressive', coating: 'Bluecut Green', brand: 'zeiss', warranty: '1 year', qty: 1, price: 0 },
    frame: { type: 'Rimless', brand: 'Rayban', warranty: '6 months', qty: 1, price: 0 },
    totalAmount: 0,
    discountAmount: 0,
    netAmount: 0,
    payMode: 'CASH',
    onlinePayAmount: 0,
    advanceAmount: 0,
    balanceAmount: 0,
    deliveryDate: new Date('2026-06-29'),
    reminderDate: new Date('2026-06-29'),
    deliveryStatus: 'Pending',
    smsSent: false
  }
];

const isMongoConnected = () => mongoose.connection.readyState === 1;

// Get Next Auto Bill Number
exports.getNextBillNo = async (req, res) => {
  try {
    if (isMongoConnected()) {
      const lastBill = await Bill.findOne().sort({ billNo: -1 });
      const nextNo = lastBill ? lastBill.billNo + 1 : 6854;
      return res.json({ nextBillNo: nextNo });
    } else {
      const maxNo = Math.max(...inMemoryBills.map(b => b.billNo), 6853);
      return res.json({ nextBillNo: maxNo + 1 });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get All Bills with Search Filter
exports.getBills = async (req, res) => {
  try {
    const { query } = req.query;
    if (isMongoConnected()) {
      let filter = {};
      if (query) {
        const regex = new RegExp(query, 'i');
        const numQuery = parseInt(query);
        filter = {
          $or: [
            { 'customer.name': regex },
            { 'customer.phone': regex },
            { 'customer.mrdNo': regex },
            ...(isNaN(numQuery) ? [] : [{ billNo: numQuery }])
          ]
        };
      }
      const bills = await Bill.find(filter).sort({ billNo: -1 });
      return res.json(bills);
    } else {
      let filtered = [...inMemoryBills];
      if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter(b => 
          b.customer.name.toLowerCase().includes(q) ||
          b.customer.phone.includes(q) ||
          b.customer.mrdNo.includes(q) ||
          b.billNo.toString().includes(q)
        );
      }
      filtered.sort((a, b) => b.billNo - a.billNo);
      return res.json(filtered);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Single Bill by ID or Bill Number
exports.getBillById = async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected()) {
      const bill = mongoose.Types.ObjectId.isValid(id) 
        ? await Bill.findById(id) 
        : await Bill.findOne({ billNo: Number(id) });
      if (!bill) return res.status(404).json({ message: 'Bill not found' });
      return res.json(bill);
    } else {
      const bill = inMemoryBills.find(b => b._id === id || b.billNo === Number(id));
      if (!bill) return res.status(404).json({ message: 'Bill not found' });
      return res.json(bill);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create New Bill
exports.createBill = async (req, res) => {
  try {
    const billData = req.body;
    const net = Number(billData.netAmount) || 0;
    const cashback = billData.cashbackEarned !== undefined ? Number(billData.cashbackEarned) : Math.round(net * 0.10);
    const redeemed = Number(billData.walletRedeemed) || 0;
    billData.cashbackEarned = cashback;
    
    if (isMongoConnected()) {
      // Auto-assign bill number if not provided
      if (!billData.billNo) {
        const lastBill = await Bill.findOne().sort({ billNo: -1 });
        billData.billNo = lastBill ? lastBill.billNo + 1 : 6854;
      }
      
      const newBill = new Bill(billData);
      await newBill.save();

      // Upsert Purchasing Customer & Update Wallet Balance
      if (billData.customer && billData.customer.phone) {
        const existingCust = await Customer.findOne({ phone: billData.customer.phone });
        let currentBal = existingCust ? (existingCust.walletBalance || 0) : 0;
        let newBal = Math.max(0, currentBal - redeemed + cashback);

        const historyItem = {
          amount: cashback,
          type: 'EARNED',
          billNo: newBill.billNo,
          note: `10% Cashback (₹${cashback}) earned on Bill #${newBill.billNo}`,
          date: new Date()
        };

        const updatePayload = { 
          name: billData.customer.name,
          phone: billData.customer.phone,
          address: billData.customer.address,
          age: billData.customer.age,
          gender: billData.customer.gender,
          mrdNo: billData.customer.mrdNo,
          walletBalance: newBal
        };

        if (billData.referrerMrd) {
          updatePayload.referredByMrd = billData.referrerMrd;
        }

        await Customer.findOneAndUpdate(
          { phone: billData.customer.phone },
          { 
            $set: updatePayload,
            $push: { walletHistory: historyItem }
          },
          { upsert: true, new: true }
        );

        // Process Referrer Bonus Cashback if referred
        if (billData.referrerMrd) {
          const referrerBonus = Math.round(net * 0.10); // 10% bonus rupees to referrer
          const referrerCust = await Customer.findOne({
            $or: [
              { mrdNo: billData.referrerMrd.trim() },
              { phone: billData.referrerMrd.trim() }
            ]
          });

          if (referrerCust) {
            referrerCust.walletBalance = (referrerCust.walletBalance || 0) + referrerBonus;
            referrerCust.referralCount = (referrerCust.referralCount || 0) + 1;
            referrerCust.walletHistory.push({
              amount: referrerBonus,
              type: 'REFERRAL_BONUS',
              billNo: newBill.billNo,
              note: `Referral Bonus (₹${referrerBonus}) from ${billData.customer.name}'s purchase (Bill #${newBill.billNo})`,
              date: new Date()
            });
            await referrerCust.save();
          }
        }
      }

      return res.status(201).json(newBill);
    } else {
      const maxNo = Math.max(...inMemoryBills.map(b => b.billNo), 6853);
      const newBill = {
        _id: 'bill_' + Date.now(),
        ...billData,
        billNo: billData.billNo || (maxNo + 1),
        date: billData.date || new Date(),
        deliveryStatus: billData.deliveryStatus || 'Pending'
      };
      inMemoryBills.unshift(newBill);
      return res.status(201).json(newBill);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update Bill
exports.updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (isMongoConnected()) {
      const updated = await Bill.findByIdAndUpdate(id, updateData, { new: true });
      if (!updated) return res.status(404).json({ message: 'Bill not found' });
      return res.json(updated);
    } else {
      const index = inMemoryBills.findIndex(b => b._id === id || b.billNo === Number(id));
      if (index === -1) return res.status(404).json({ message: 'Bill not found' });
      inMemoryBills[index] = { ...inMemoryBills[index], ...updateData };
      return res.json(inMemoryBills[index]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete Bill
exports.deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected()) {
      const deleted = await Bill.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ message: 'Bill not found' });
      return res.json({ message: 'Bill deleted successfully' });
    } else {
      const index = inMemoryBills.findIndex(b => b._id === id || b.billNo === Number(id));
      if (index === -1) return res.status(404).json({ message: 'Bill not found' });
      inMemoryBills.splice(index, 1);
      return res.json({ message: 'Bill deleted successfully' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle Delivery Status & Settlement
exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, advanceAmount, balanceAmount, payMode } = req.body;

    const updateFields = { deliveryStatus: status };
    if (advanceAmount !== undefined) updateFields.advanceAmount = Number(advanceAmount);
    if (balanceAmount !== undefined) updateFields.balanceAmount = Number(balanceAmount);
    if (payMode !== undefined) updateFields.payMode = payMode;

    if (isMongoConnected()) {
      const updated = await Bill.findByIdAndUpdate(id, updateFields, { new: true });
      return res.json(updated);
    } else {
      const bill = inMemoryBills.find(b => b._id === id || b.billNo === Number(id));
      if (!bill) return res.status(404).json({ message: 'Bill not found' });
      Object.assign(bill, updateFields);
      return res.json(bill);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Send SMS Notification
exports.sendSMS = async (req, res) => {
  try {
    const { id } = req.params;
    // Mock SMS integration response
    if (isMongoConnected()) {
      await Bill.findByIdAndUpdate(id, { smsSent: true });
    } else {
      const bill = inMemoryBills.find(b => b._id === id || b.billNo === Number(id));
      if (bill) bill.smsSent = true;
    }
    return res.json({ success: true, message: 'SMS notification dispatched to customer phone.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

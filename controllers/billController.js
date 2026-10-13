const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const mongoose = require('mongoose');

// Helper to format bill numbers into continuous serial string (e.g. 001, 002, ... 010 ... 999, 1000 ... 2000)
const formatBillNo = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const num = parseInt(String(val).replace(/\D/g, ''), 10);
  if (isNaN(num)) return String(val).trim();
  return String(num).padStart(3, '0');
};

const parseBillNo = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseInt(String(val).replace(/\D/g, ''), 10);
  return isNaN(num) ? 0 : num;
};

// In-Memory fallback store for demo & fallback when Mongo DB is offline
let inMemoryBills = [];

const isMongoConnected = () => mongoose.connection.readyState === 1;

// Get Next Auto Bill Number (001, 002, 003... 010... 999, 1000... 2000)
exports.getNextBillNo = async (req, res) => {
  try {
    if (isMongoConnected()) {
      const bills = await Bill.find({}, 'billNo');
      let maxNo = 0;
      bills.forEach(b => {
        const num = parseBillNo(b.billNo);
        if (num > maxNo) maxNo = num;
      });
      const nextNum = maxNo + 1;
      const formatted = String(nextNum).padStart(3, '0');
      return res.json({ nextBillNo: formatted, nextBillNum: nextNum });
    } else {
      let maxNo = 0;
      inMemoryBills.forEach(b => {
        const num = parseBillNo(b.billNo);
        if (num > maxNo) maxNo = num;
      });
      const nextNum = maxNo + 1;
      const formatted = String(nextNum).padStart(3, '0');
      return res.json({ nextBillNo: formatted, nextBillNum: nextNum });
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
        const numQuery = parseInt(query, 10);
        const formattedQuery = !isNaN(numQuery) ? String(numQuery).padStart(3, '0') : null;
        filter = {
          $or: [
            { 'customer.name': regex },
            { 'customer.phone': regex },
            { 'customer.mrdNo': regex },
            { billNo: regex },
            ...(formattedQuery ? [{ billNo: formattedQuery }] : []),
            ...(isNaN(numQuery) ? [] : [{ billNo: numQuery }])
          ]
        };
      }
      const bills = await Bill.find(filter);
      // Sort numerically by billNo descending
      bills.sort((a, b) => {
        const numA = parseBillNo(a.billNo);
        const numB = parseBillNo(b.billNo);
        return numB - numA;
      });
      return res.json(bills);
    } else {
      let filtered = [...inMemoryBills];
      if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter(b => 
          (b.customer?.name && b.customer.name.toLowerCase().includes(q)) ||
          (b.customer?.phone && b.customer.phone.includes(q)) ||
          (b.customer?.mrdNo && b.customer.mrdNo.includes(q)) ||
          (b.billNo && (String(b.billNo).includes(q) || formatBillNo(b.billNo).toLowerCase().includes(q)))
        );
      }
      filtered.sort((a, b) => parseBillNo(b.billNo) - parseBillNo(a.billNo));
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
    const num = parseInt(String(id).replace(/\D/g, ''), 10);
    const formatted = !isNaN(num) && num > 0 ? String(num).padStart(3, '0') : null;

    if (isMongoConnected()) {
      let bill = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        bill = await Bill.findById(id);
      }
      if (!bill) {
        bill = await Bill.findOne({
          $or: [
            { billNo: id },
            ...(formatted ? [{ billNo: formatted }] : []),
            ...(isNaN(num) ? [] : [{ billNo: num }])
          ]
        });
      }
      if (!bill) return res.status(404).json({ message: 'Bill not found' });
      return res.json(bill);
    } else {
      const bill = inMemoryBills.find(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
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
      // Auto-assign continuous bill number starting from 001 if not provided
      if (!billData.billNo) {
        const bills = await Bill.find({}, 'billNo');
        let maxNo = 0;
        bills.forEach(b => {
          const num = parseBillNo(b.billNo);
          if (num > maxNo) maxNo = num;
        });
        billData.billNo = String(maxNo + 1).padStart(3, '0');
      } else {
        billData.billNo = formatBillNo(billData.billNo);
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
      let maxNo = 0;
      inMemoryBills.forEach(b => {
        const num = parseBillNo(b.billNo);
        if (num > maxNo) maxNo = num;
      });
      const assignedBillNo = billData.billNo ? formatBillNo(billData.billNo) : String(maxNo + 1).padStart(3, '0');
      const newBill = {
        _id: 'bill_' + Date.now(),
        ...billData,
        billNo: assignedBillNo,
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
    if (updateData.billNo !== undefined && updateData.billNo !== null) {
      updateData.billNo = formatBillNo(updateData.billNo);
    }

    const num = parseInt(String(id).replace(/\D/g, ''), 10);
    const formatted = !isNaN(num) && num > 0 ? String(num).padStart(3, '0') : null;

    if (isMongoConnected()) {
      let updated = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        updated = await Bill.findByIdAndUpdate(id, updateData, { new: true });
      }
      if (!updated) {
        updated = await Bill.findOneAndUpdate({
          $or: [
            { billNo: id },
            ...(formatted ? [{ billNo: formatted }] : []),
            ...(isNaN(num) ? [] : [{ billNo: num }])
          ]
        }, updateData, { new: true });
      }
      if (!updated) return res.status(404).json({ message: 'Bill not found' });
      return res.json(updated);
    } else {
      const index = inMemoryBills.findIndex(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
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
    const num = parseInt(String(id).replace(/\D/g, ''), 10);
    const formatted = !isNaN(num) && num > 0 ? String(num).padStart(3, '0') : null;

    if (isMongoConnected()) {
      let deleted = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        deleted = await Bill.findByIdAndDelete(id);
      }
      if (!deleted) {
        deleted = await Bill.findOneAndDelete({
          $or: [
            { billNo: id },
            ...(formatted ? [{ billNo: formatted }] : []),
            ...(isNaN(num) ? [] : [{ billNo: num }])
          ]
        });
      }
      if (!deleted) return res.status(404).json({ message: 'Bill not found' });
      return res.json({ message: 'Bill deleted successfully' });
    } else {
      const index = inMemoryBills.findIndex(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
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

    const num = parseInt(String(id).replace(/\D/g, ''), 10);
    const formatted = !isNaN(num) && num > 0 ? String(num).padStart(3, '0') : null;

    if (isMongoConnected()) {
      let updated = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        updated = await Bill.findByIdAndUpdate(id, updateFields, { new: true });
      }
      if (!updated) {
        updated = await Bill.findOneAndUpdate({
          $or: [
            { billNo: id },
            ...(formatted ? [{ billNo: formatted }] : []),
            ...(isNaN(num) ? [] : [{ billNo: num }])
          ]
        }, updateFields, { new: true });
      }
      return res.json(updated);
    } else {
      const bill = inMemoryBills.find(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
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
    const num = parseInt(String(id).replace(/\D/g, ''), 10);
    const formatted = !isNaN(num) && num > 0 ? String(num).padStart(3, '0') : null;

    if (isMongoConnected()) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        await Bill.findByIdAndUpdate(id, { smsSent: true });
      } else {
        await Bill.findOneAndUpdate({
          $or: [
            { billNo: id },
            ...(formatted ? [{ billNo: formatted }] : []),
            ...(isNaN(num) ? [] : [{ billNo: num }])
          ]
        }, { smsSent: true });
      }
    } else {
      const bill = inMemoryBills.find(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
      if (bill) bill.smsSent = true;
    }
    return res.json({ success: true, message: 'SMS/WhatsApp notification marked as dispatched.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle/Update Reminder & SMS Sent Status
exports.toggleReminderSent = async (req, res) => {
  try {
    const { id } = req.params;
    const { sent } = req.body;
    const num = parseInt(String(id).replace(/\D/g, ''), 10);
    const formatted = !isNaN(num) && num > 0 ? String(num).padStart(3, '0') : null;

    if (isMongoConnected()) {
      let bill = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        bill = await Bill.findById(id);
      }
      if (!bill) {
        bill = await Bill.findOne({
          $or: [
            { billNo: id },
            ...(formatted ? [{ billNo: formatted }] : []),
            ...(isNaN(num) ? [] : [{ billNo: num }])
          ]
        });
      }
      if (!bill) return res.status(404).json({ message: 'Bill not found' });

      bill.smsSent = sent !== undefined ? Boolean(sent) : !bill.smsSent;
      await bill.save();
      return res.json(bill);
    } else {
      const bill = inMemoryBills.find(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
      if (!bill) return res.status(404).json({ message: 'Bill not found' });
      bill.smsSent = sent !== undefined ? Boolean(sent) : !bill.smsSent;
      return res.json(bill);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update Follow-Up Status & Timestamps
exports.updateFollowUpStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 'Sent', type } = req.body;
    const now = new Date();

    const updateFields = {
      followUpStatus: status,
      'followUpDetails.lastContactedAt': now
    };

    if (type === 'service') {
      updateFields['followUpDetails.serviceSentAt'] = now;
    } else if (type === 'feedback') {
      updateFields['followUpDetails.feedbackSentAt'] = now;
    } else if (type === 'eyecheck') {
      updateFields['followUpDetails.eyeCheckSentAt'] = now;
    }

    const num = parseInt(String(id).replace(/\D/g, ''), 10);
    const formatted = !isNaN(num) && num > 0 ? String(num).padStart(3, '0') : null;

    if (isMongoConnected()) {
      let updated = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        updated = await Bill.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
      }
      if (!updated) {
        updated = await Bill.findOneAndUpdate({
          $or: [
            { billNo: id },
            ...(formatted ? [{ billNo: formatted }] : []),
            ...(isNaN(num) ? [] : [{ billNo: num }])
          ]
        }, { $set: updateFields }, { new: true });
      }

      if (!updated) return res.status(404).json({ message: 'Bill not found' });
      return res.json(updated);
    } else {
      const bill = inMemoryBills.find(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
      if (!bill) return res.status(404).json({ message: 'Bill not found' });

      bill.followUpStatus = status;
      if (!bill.followUpDetails) bill.followUpDetails = {};
      bill.followUpDetails.lastContactedAt = now;
      if (type === 'service') bill.followUpDetails.serviceSentAt = now;
      if (type === 'feedback') bill.followUpDetails.feedbackSentAt = now;
      if (type === 'eyecheck') bill.followUpDetails.eyeCheckSentAt = now;

      return res.json(bill);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

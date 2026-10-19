const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const mongoose = require('mongoose');
const { escapeRegExp } = require('../middleware/validate');

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

// In-Memory fallback store for demo & fallback when MongoDB is offline
let inMemoryBills = [];

const isMongoConnected = () => mongoose.connection.readyState === 1;

/**
 * Optimized helper to compute the maximum bill number in database
 * Runs atomic database aggregation instead of pulling all records into memory
 */
const getDatabaseMaxBillNo = async () => {
  try {
    const result = await Bill.aggregate([
      {
        $group: {
          _id: null,
          maxNo: {
            $max: {
              $convert: { input: '$billNo', to: 'int', onError: 0, onNull: 0 }
            }
          }
        }
      }
    ]);
    return (result && result[0] && result[0].maxNo) ? result[0].maxNo : 0;
  } catch (err) {
    // Fallback: fetch recent bills with limit
    const recent = await Bill.find({}, { billNo: 1 })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    let maxNo = 0;
    recent.forEach(b => {
      const num = parseBillNo(b.billNo);
      if (num > maxNo) maxNo = num;
    });
    return maxNo;
  }
};

// Get Next Auto Bill Number (001, 002, 003... 010... 999, 1000... 2000)
exports.getNextBillNo = async (req, res, next) => {
  try {
    if (isMongoConnected()) {
      const maxNo = await getDatabaseMaxBillNo();
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
    next(error);
  }
};

// Get All Bills with Search Filter, Lean hydration, and Safe Regex
exports.getBills = async (req, res, next) => {
  try {
    const { query, limit = 2000 } = req.query;
    const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 1000), 5000);

    if (isMongoConnected()) {
      let filter = {};
      if (query && String(query).trim()) {
        const sanitized = escapeRegExp(String(query).trim());
        const regex = new RegExp(sanitized, 'i');
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

      const bills = await Bill.find(filter)
        .limit(maxLimit)
        .lean();

      // Sort numerically by billNo descending
      bills.sort((a, b) => {
        const numA = parseBillNo(a.billNo);
        const numB = parseBillNo(b.billNo);
        return numB - numA;
      });

      return res.json(bills);
    } else {
      let filtered = [...inMemoryBills];
      if (query && String(query).trim()) {
        const q = String(query).trim().toLowerCase();
        filtered = filtered.filter(b => 
          (b.customer?.name && b.customer.name.toLowerCase().includes(q)) ||
          (b.customer?.phone && b.customer.phone.includes(q)) ||
          (b.customer?.mrdNo && b.customer.mrdNo.includes(q)) ||
          (b.billNo && (String(b.billNo).includes(q) || formatBillNo(b.billNo).toLowerCase().includes(q)))
        );
      }
      filtered.sort((a, b) => parseBillNo(b.billNo) - parseBillNo(a.billNo));
      return res.json(filtered.slice(0, maxLimit));
    }
  } catch (error) {
    next(error);
  }
};

// Get Single Bill by ID or Bill Number
exports.getBillById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const num = parseInt(String(id).replace(/\D/g, ''), 10);
    const formatted = !isNaN(num) && num > 0 ? String(num).padStart(3, '0') : null;

    if (isMongoConnected()) {
      let bill = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        bill = await Bill.findById(id).lean();
      }
      if (!bill) {
        bill = await Bill.findOne({
          $or: [
            { billNo: id },
            ...(formatted ? [{ billNo: formatted }] : []),
            ...(isNaN(num) ? [] : [{ billNo: num }])
          ]
        }).lean();
      }
      if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
      return res.json(bill);
    } else {
      const bill = inMemoryBills.find(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
      if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
      return res.json(bill);
    }
  } catch (error) {
    next(error);
  }
};

// Create New Bill with Atomic Updates & Race-Condition Safeguards
exports.createBill = async (req, res, next) => {
  try {
    const billData = req.body;
    const net = Number(billData.netAmount) || 0;
    const cashback = billData.cashbackEarned !== undefined ? Number(billData.cashbackEarned) : Math.round(net * 0.10);
    const redeemed = Number(billData.walletRedeemed) || 0;
    billData.cashbackEarned = cashback;
    
    if (isMongoConnected()) {
      // Auto-assign continuous bill number starting from 001 if not provided
      if (!billData.billNo) {
        const maxNo = await getDatabaseMaxBillNo();
        billData.billNo = String(maxNo + 1).padStart(3, '0');
      } else {
        billData.billNo = formatBillNo(billData.billNo);
      }

      const newBill = new Bill(billData);
      await newBill.save();

      // Upsert Purchasing Customer & Update Wallet Balance
      if (billData.customer && billData.customer.phone) {
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
          mrdNo: billData.customer.mrdNo
        };

        if (billData.referrerMrd) {
          updatePayload.referredByMrd = billData.referrerMrd;
        }

        // Fetch existing customer to calculate non-negative balance securely
        const existingCust = await Customer.findOne({ phone: billData.customer.phone }).lean();
        const currentBal = existingCust ? (existingCust.walletBalance || 0) : 0;
        const newBal = Math.max(0, currentBal - redeemed + cashback);
        updatePayload.walletBalance = newBal;

        await Customer.findOneAndUpdate(
          { phone: billData.customer.phone },
          { 
            $set: updatePayload,
            $push: { walletHistory: historyItem }
          },
          { upsert: true, new: true }
        );

        // Process Referrer Bonus Cashback if referred using ATOMIC $inc and $push
        if (billData.referrerMrd && String(billData.referrerMrd).trim()) {
          const referrerBonus = Math.round(net * 0.10);
          const trimmedRef = String(billData.referrerMrd).trim();
          
          await Customer.findOneAndUpdate(
            {
              $or: [
                { mrdNo: trimmedRef },
                { phone: trimmedRef }
              ]
            },
            {
              $inc: { walletBalance: referrerBonus, referralCount: 1 },
              $push: {
                walletHistory: {
                  amount: referrerBonus,
                  type: 'REFERRAL_BONUS',
                  billNo: newBill.billNo,
                  note: `Referral Bonus (₹${referrerBonus}) from ${billData.customer.name}'s purchase (Bill #${newBill.billNo})`,
                  date: new Date()
                }
              }
            }
          );
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
    next(error);
  }
};

// Update Bill
exports.updateBill = async (req, res, next) => {
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
      if (!updated) return res.status(404).json({ success: false, message: 'Bill not found' });
      return res.json(updated);
    } else {
      const index = inMemoryBills.findIndex(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
      if (index === -1) return res.status(404).json({ success: false, message: 'Bill not found' });
      inMemoryBills[index] = { ...inMemoryBills[index], ...updateData };
      return res.json(inMemoryBills[index]);
    }
  } catch (error) {
    next(error);
  }
};

// Delete Bill
exports.deleteBill = async (req, res, next) => {
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
      if (!deleted) return res.status(404).json({ success: false, message: 'Bill not found' });
      return res.json({ success: true, message: 'Bill deleted successfully' });
    } else {
      const index = inMemoryBills.findIndex(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
      if (index === -1) return res.status(404).json({ success: false, message: 'Bill not found' });
      inMemoryBills.splice(index, 1);
      return res.json({ success: true, message: 'Bill deleted successfully' });
    }
  } catch (error) {
    next(error);
  }
};

// Toggle Delivery Status & Settlement
exports.updateDeliveryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, advanceAmount, balanceAmount, payMode, deliveryAmount, deliveryDate } = req.body;

    const updateFields = {};
    if (status !== undefined) updateFields.deliveryStatus = status;
    if (advanceAmount !== undefined) updateFields.advanceAmount = Number(advanceAmount);
    if (balanceAmount !== undefined) updateFields.balanceAmount = Number(balanceAmount);
    if (deliveryAmount !== undefined) updateFields.deliveryAmount = Number(deliveryAmount);
    if (deliveryDate !== undefined) updateFields.deliveryDate = deliveryDate;
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
      if (!updated) return res.status(404).json({ success: false, message: 'Bill not found' });
      return res.json(updated);
    } else {
      const bill = inMemoryBills.find(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
      if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
      Object.assign(bill, updateFields);
      return res.json(bill);
    }
  } catch (error) {
    next(error);
  }
};

// Send SMS Notification
exports.sendSMS = async (req, res, next) => {
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
    next(error);
  }
};

// Toggle/Update Reminder & SMS Sent Status
exports.toggleReminderSent = async (req, res, next) => {
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
      if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

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
      if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
      bill.smsSent = sent !== undefined ? Boolean(sent) : !bill.smsSent;
      return res.json(bill);
    }
  } catch (error) {
    next(error);
  }
};

// Update Follow-Up Status & Timestamps
exports.updateFollowUpStatus = async (req, res, next) => {
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

      if (!updated) return res.status(404).json({ success: false, message: 'Bill not found' });
      return res.json(updated);
    } else {
      const bill = inMemoryBills.find(b => 
        b._id === id || 
        String(b.billNo) === String(id) || 
        (formatted && String(b.billNo) === formatted) || 
        (!isNaN(num) && parseBillNo(b.billNo) === num)
      );
      if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

      bill.followUpStatus = status;
      if (!bill.followUpDetails) bill.followUpDetails = {};
      bill.followUpDetails.lastContactedAt = now;
      if (type === 'service') bill.followUpDetails.serviceSentAt = now;
      if (type === 'feedback') bill.followUpDetails.feedbackSentAt = now;
      if (type === 'eyecheck') bill.followUpDetails.eyeCheckSentAt = now;

      return res.json(bill);
    }
  } catch (error) {
    next(error);
  }
};

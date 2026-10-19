const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// Set test environment
process.env.NODE_ENV = 'test';
const app = require('../server');

test('Backend API Test Suite', async (t) => {
  let createdBillId = null;

  await t.test('GET /api/health should return 200 and system status', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'online');
    assert.ok(res.body.timestamp);
    assert.ok(res.body.database);
  });

  await t.test('Security Headers - Helmet should be enabled', async () => {
    const res = await request(app).get('/api/health');
    assert.ok(res.headers['x-content-type-options'], 'nosniff header should be set');
    assert.ok(res.headers['x-frame-options'], 'frameguard header should be set');
  });

  await t.test('GET /api/catalog should return default or db catalog', async () => {
    const res = await request(app).get('/api/catalog');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.orderTakenOptions));
    assert.ok(Array.isArray(res.body.lensTypes));
    assert.ok(Array.isArray(res.body.frameBrands));
  });

  await t.test('GET /api/bills/next-number should return formatted 3-digit serial number', async () => {
    const res = await request(app).get('/api/bills/next-number');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.nextBillNo);
    assert.ok(typeof res.body.nextBillNum === 'number');
    assert.ok(res.body.nextBillNo.length >= 3);
  });

  await t.test('GET /api/customers/lookup/:query should handle regex special characters safely without crashing', async () => {
    const res = await request(app).get('/api/customers/lookup/[test*+');
    assert.strictEqual(res.statusCode, 200);
  });

  await t.test('GET /api/customers should return customers list', async () => {
    const res = await request(app).get('/api/customers');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
  });

  await t.test('POST /api/bills should validate customer name length', async () => {
    const hugeName = 'A'.repeat(300);
    const res = await request(app)
      .post('/api/bills')
      .send({
        customer: { name: hugeName, phone: '9999999999' }
      });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  await t.test('POST /api/bills should create new bill with assigned continuous serial', async () => {
    const testBill = {
      customer: {
        name: 'Automated Test Customer',
        phone: '9876543210',
        address: 'Test City',
        age: 30,
        gender: 'Male'
      },
      netAmount: 1200,
      totalAmount: 1500,
      advanceAmount: 500,
      balanceAmount: 700,
      payMode: 'UPI'
    };

    const res = await request(app)
      .post('/api/bills')
      .send(testBill);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.body.billNo);
    assert.strictEqual(res.body.customer.name, 'Automated Test Customer');
    createdBillId = res.body._id;
  });

  await t.test('GET /api/bills should search and filter bills safely', async () => {
    const res = await request(app).get('/api/bills?query=Automated');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
  });

  await t.test('PATCH /api/bills/:id/delivery should update delivery status and amounts', async () => {
    const targetId = createdBillId || '001';
    const res = await request(app)
      .patch(`/api/bills/${targetId}/delivery`)
      .send({
        status: 'Delivered',
        advanceAmount: 1200,
        balanceAmount: 0
      });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.deliveryStatus, 'Delivered');
  });

  await t.test('PATCH /api/bills/:id/followup should update follow-up timestamps', async () => {
    const targetId = createdBillId || '001';
    const res = await request(app)
      .patch(`/api/bills/${targetId}/followup`)
      .send({
        status: 'Contacted',
        type: 'feedback'
      });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.followUpStatus, 'Contacted');
  });

  await t.test('GET /api/undefined-route should return 404 with structured JSON', async () => {
    const res = await request(app).get('/api/undefined-route');
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('API route not found'));
  });
});

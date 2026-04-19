const express = require('express');
const request = require('supertest');

const paymentsRouter = require('../routes/payments');

describe('Table 8 - Testing Payments Feature', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paymentsRouter);

  test('returns available subscription plans', async () => {
    const res = await request(app).get('/api/payments/plans');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.plans.basic).toBeDefined();
    expect(res.body.plans.basic.price).toBe(300);
  });

  test('returns 401 for status endpoint when token is missing', async () => {
    const res = await request(app).get('/api/payments/status');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Access token required');
  });
});

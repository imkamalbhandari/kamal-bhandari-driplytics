const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.userId = 'user1';
    next();
  }
}));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  find: jest.fn()
}));

jest.mock('../models/Listing', () => ({
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  deleteMany: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn()
}));

jest.mock('../models/Message', () => ({
  countDocuments: jest.fn(),
  distinct: jest.fn()
}));

jest.mock('../models/Payment', () => ({
  aggregate: jest.fn(),
  find: jest.fn()
}));

const User = require('../models/User');
const adminRouter = require('../routes/admin');

describe('Table 10 - Testing Admin Feature', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);

  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockResolvedValue({ _id: 'user1', isAdmin: true });
  });

  test('rejects toggling your own admin status', async () => {
    const res = await request(app).put('/api/admin/users/user1/toggle-admin').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cannot change your own admin status');
  });

  test('rejects invalid listing status update value', async () => {
    const res = await request(app)
      .put('/api/admin/listings/listing1/status')
      .send({ status: 'invalid-status' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid status');
  });
});

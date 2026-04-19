const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.userId = 'user1';
    next();
  }
}));

jest.mock('../models/Alert', () => {
  const saveMock = jest.fn().mockResolvedValue(undefined);
  const Alert = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: 'alert1',
    save: saveMock
  }));
  Alert.countDocuments = jest.fn();
  Alert.find = jest.fn();
  Alert.__saveMock = saveMock;
  return Alert;
});

jest.mock('../services/emailService', () => ({
  sendAlertEmail: jest.fn()
}));

jest.mock('../services/smsService', () => ({
  sendAlertSMS: jest.fn()
}));

const Alert = require('../models/Alert');
const alertsRouter = require('../routes/alerts');

describe('Table 6 - Testing Alerts Feature', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/alerts', alertsRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects creating alert when required fields are missing', async () => {
    const res = await request(app).post('/api/alerts').send({ brand: 'Nike' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Sneaker name and target price are required');
  });

  test('rejects creating alert when user already has 20 alerts', async () => {
    Alert.countDocuments.mockResolvedValue(20);

    const res = await request(app).post('/api/alerts').send({
      sneakerName: 'Air Jordan 1',
      targetPrice: 250
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Maximum 20 alerts allowed. Please remove some first.');
  });
});

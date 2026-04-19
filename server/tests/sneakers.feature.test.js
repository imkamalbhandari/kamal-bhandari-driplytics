const express = require('express');
const request = require('supertest');

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

const axios = require('axios');
const sneakersRouter = require('../routes/sneakers');

describe('Table 9 - Testing Sneakers Feature', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/sneakers', sneakersRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns brand list from ML service', async () => {
    axios.get.mockResolvedValue({
      data: {
        success: true,
        brands: ['Nike', 'Adidas']
      }
    });

    const res = await request(app).get('/api/sneakers/brands');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.brands).toEqual(['Nike', 'Adidas']);
  });

  test('returns 500 when prediction service fails', async () => {
    axios.post.mockRejectedValue({
      response: {
        data: {
          error: 'ML service unavailable'
        }
      },
      message: 'Request failed'
    });

    const res = await request(app).post('/api/sneakers/predict').send({
      brand: 'Nike',
      retail_price: 200,
      release_date: '2024-01-01',
      sneaker_name: 'Air Jordan 1'
    });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Failed to get prediction');
    expect(res.body.message).toBe('ML service unavailable');
  });
});

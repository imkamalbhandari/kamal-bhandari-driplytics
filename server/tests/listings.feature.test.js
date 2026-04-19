const express = require('express');
const request = require('supertest');

jest.mock('../models/Listing', () => ({
  find: jest.fn(),
  findById: jest.fn()
}));

jest.mock('../models/User', () => ({
  findById: jest.fn()
}));

const Listing = require('../models/Listing');
const listingsRouter = require('../routes/listings');

describe('Table 7 - Testing Listings Feature', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/listings', listingsRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns filtered active listings successfully', async () => {
    Listing.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        {
          _id: 'listing1',
          sellerId: 'seller1',
          sellerUsername: 'seller',
          sneakerId: 'sku-1',
          name: 'Air Max',
          brand: 'Nike',
          colorway: 'White',
          styleCode: 'NK-1',
          size: '9',
          condition: 'new',
          askingPrice: 220,
          retailPrice: 180,
          description: '',
          image: null,
          status: 'active',
          createdAt: new Date('2026-01-01T00:00:00.000Z')
        }
      ])
    });

    const res = await request(app).get('/api/listings?brand=Nike&sort=price-low');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].brand).toBe('Nike');
  });

  test('returns 404 when listing is not found by id', async () => {
    Listing.findById.mockResolvedValue(null);

    const res = await request(app).get('/api/listings/not-found-id');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Listing not found');
  });
});

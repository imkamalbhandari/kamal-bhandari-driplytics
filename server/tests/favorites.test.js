const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-favorites-secret';
process.env.ML_SERVICE_URL = 'http://test-ml-service';

jest.mock('../models/Favorite', () => {
  const saveMock = jest.fn().mockResolvedValue(undefined);
  const Favorite = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: 'fav1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    save: saveMock
  }));

  Favorite.findOne = jest.fn();
  Favorite.findOneAndDelete = jest.fn();
  Favorite.find = jest.fn();
  Favorite.__saveMock = saveMock;
  return Favorite;
});

jest.mock('axios', () => ({
  post: jest.fn()
}));

const Favorite = require('../models/Favorite');
const axios = require('axios');
const favoritesRouter = require('../routes/favorites');

describe('Table 5 - Testing Favorites Module', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/favorites', favoritesRouter);

  const token = jwt.sign({ userId: 'user1', email: 'u@test.com' }, process.env.JWT_SECRET, {
    expiresIn: '1h'
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects add favorite when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sneaker Only' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('sneakerId, name, and brand are required');
  });

  test('rejects duplicate favorite', async () => {
    Favorite.findOne.mockResolvedValue({ _id: 'existing-fav' });

    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ sneakerId: 'sku-1', name: 'Sneaker A', brand: 'Nike' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Sneaker already in favorites');
  });

  test('adds favorite successfully', async () => {
    Favorite.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sneakerId: 'sku-2',
        name: 'Sneaker B',
        brand: 'Adidas',
        retailPrice: 220
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Favorite.__saveMock).toHaveBeenCalledTimes(1);
  });

  test('lists favorites with computed price data', async () => {
    Favorite.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        {
          _id: 'fav1',
          sneakerId: 'sku-2',
          name: 'Sneaker B',
          brand: 'Adidas',
          colorway: 'White',
          styleCode: 'ABC',
          retailPrice: 220,
          savedPrice: 240,
          releaseDate: '2024-01-01',
          gender: 'men',
          volatility: 0.15,
          image: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z')
        }
      ])
    });

    axios.post.mockResolvedValue({
      data: {
        success: true,
        predictions: {
          ensemble: {
            predicted_price: 260
          }
        }
      }
    });

    const res = await request(app)
      .get('/api/favorites')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].currentPrice).toBe(260);
  });

  test('returns 404 when deleting non-existing favorite', async () => {
    Favorite.findOneAndDelete.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/favorites/fav-not-found')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Favorite not found');
  });

  test('deletes favorite successfully', async () => {
    Favorite.findOneAndDelete.mockResolvedValue({ _id: 'fav1' });

    const res = await request(app)
      .delete('/api/favorites/fav1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Removed from favorites');
  });

  test('returns 401 when token is missing', async () => {
    const res = await request(app).get('/api/favorites');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Access token required');
  });

  test('returns 403 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/favorites')
      .set('Authorization', 'Bearer invalid.token.value');

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Invalid or expired token');
  });

  test('falls back to saved price when ML service call fails', async () => {
    Favorite.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        {
          _id: 'fav2',
          sneakerId: 'sku-3',
          name: 'Sneaker C',
          brand: 'Puma',
          colorway: 'Black',
          styleCode: 'PUM123',
          retailPrice: 150,
          savedPrice: 175,
          releaseDate: '2024-06-01',
          gender: 'men',
          volatility: 0.12,
          image: null,
          createdAt: new Date('2026-01-05T00:00:00.000Z')
        }
      ])
    });

    axios.post.mockRejectedValue(new Error('ML service unavailable'));

    const res = await request(app)
      .get('/api/favorites')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].currentPrice).toBe(175);
    expect(res.body.data[0].priceChange).toBe('+0%');
  });

  test('checks sneaker favorite status as true when record exists', async () => {
    Favorite.findOne.mockResolvedValue({ _id: 'fav-check-1' });

    const res = await request(app)
      .get('/api/favorites/check/sku-check-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isFavorite).toBe(true);
    expect(res.body.favoriteId).toBe('fav-check-1');
  });

  test('checks sneaker favorite status as false when record is missing', async () => {
    Favorite.findOne.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/favorites/check/sku-check-2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isFavorite).toBe(false);
    expect(res.body.favoriteId).toBeUndefined();
  });

  test('returns duplicate error when save throws unique key violation', async () => {
    Favorite.findOne.mockResolvedValue(null);
    Favorite.__saveMock.mockRejectedValueOnce({ code: 11000 });

    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sneakerId: 'sku-dup-save',
        name: 'Sneaker D',
        brand: 'Nike'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Sneaker already in favorites');
  });
});

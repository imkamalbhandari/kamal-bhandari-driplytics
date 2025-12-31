const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Favorite = require('../models/Favorite');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Get all favorites for the authenticated user
 * GET /api/favorites
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.userId }).sort({ createdAt: -1 });
    
    // Fetch current prices for each favorite
    const favoritesWithPrices = await Promise.all(
      favorites.map(async (fav) => {
        try {
          // Get prediction for current price estimate
          const predResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
            brand: fav.brand,
            gender: fav.gender || 'men',
            retail_price: fav.retailPrice,
            release_date: fav.releaseDate,
            volatility: fav.volatility || 0.15
          });
          
          const currentPrice = predResponse.data.success 
            ? predResponse.data.predictions.ensemble.predicted_price 
            : fav.savedPrice;
          
          const priceChange = fav.savedPrice > 0 
            ? ((currentPrice - fav.savedPrice) / fav.savedPrice * 100).toFixed(1)
            : 0;

          return {
            id: fav._id,
            sneakerId: fav.sneakerId,
            name: fav.name,
            brand: fav.brand,
            colorway: fav.colorway,
            styleCode: fav.styleCode,
            retailPrice: fav.retailPrice,
            currentPrice: Math.round(currentPrice),
            savedPrice: fav.savedPrice,
            priceChange: `${priceChange >= 0 ? '+' : ''}${priceChange}%`,
            addedDate: fav.createdAt.toISOString().split('T')[0],
            releaseDate: fav.releaseDate,
            gender: fav.gender,
            volatility: fav.volatility
          };
        } catch (err) {
          return {
            id: fav._id,
            sneakerId: fav.sneakerId,
            name: fav.name,
            brand: fav.brand,
            colorway: fav.colorway,
            styleCode: fav.styleCode,
            retailPrice: fav.retailPrice,
            currentPrice: fav.savedPrice,
            savedPrice: fav.savedPrice,
            priceChange: '+0%',
            addedDate: fav.createdAt.toISOString().split('T')[0],
            releaseDate: fav.releaseDate,
            gender: fav.gender,
            volatility: fav.volatility
          };
        }
      })
    );

    res.json({
      success: true,
      data: favoritesWithPrices,
      count: favoritesWithPrices.length
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ success: false, error: 'Failed to get favorites' });
  }
});

/**
 * Add a sneaker to favorites
 * POST /api/favorites
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { sneakerId, name, brand, colorway, styleCode, retailPrice, releaseDate, savedPrice, gender, volatility } = req.body;

    if (!sneakerId || !name || !brand) {
      return res.status(400).json({ success: false, message: 'sneakerId, name, and brand are required' });
    }

    // Check if already favorited
    const existing = await Favorite.findOne({ userId: req.userId, sneakerId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Sneaker already in favorites' });
    }

    const favorite = new Favorite({
      userId: req.userId,
      sneakerId,
      name,
      brand,
      colorway: colorway || '',
      styleCode: styleCode || '',
      retailPrice: retailPrice || 0,
      releaseDate: releaseDate || '',
      savedPrice: savedPrice || retailPrice || 0,
      gender: gender || 'men',
      volatility: volatility || 0.15
    });

    await favorite.save();

    res.status(201).json({
      success: true,
      message: 'Added to favorites',
      data: favorite
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Sneaker already in favorites' });
    }
    res.status(500).json({ success: false, error: 'Failed to add favorite' });
  }
});

/**
 * Remove a sneaker from favorites
 * DELETE /api/favorites/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await Favorite.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Favorite not found' });
    }

    res.json({
      success: true,
      message: 'Removed from favorites'
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove favorite' });
  }
});

/**
 * Check if a sneaker is favorited
 * GET /api/favorites/check/:sneakerId
 */
router.get('/check/:sneakerId', authenticateToken, async (req, res) => {
  try {
    const favorite = await Favorite.findOne({
      userId: req.userId,
      sneakerId: req.params.sneakerId
    });

    res.json({
      success: true,
      isFavorite: !!favorite,
      favoriteId: favorite?._id
    });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({ success: false, error: 'Failed to check favorite' });
  }
});

module.exports = router;

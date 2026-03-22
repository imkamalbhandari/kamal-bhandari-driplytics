const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Listing = require('../models/Listing');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

// Optional auth - allows request to proceed without token
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
    } catch (error) {
      // Token invalid, but we continue without auth
    }
  }
  next();
};

/**
 * Get all active listings (marketplace)
 * GET /api/listings
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { brand, condition, minPrice, maxPrice, size, sort, search } = req.query;
    
    let query = { status: 'active' };
    
    // Apply filters
    if (brand) {
      query.brand = { $regex: brand, $options: 'i' };
    }
    if (condition) {
      query.condition = condition;
    }
    if (size) {
      query.size = size;
    }
    if (minPrice || maxPrice) {
      query.askingPrice = {};
      if (minPrice) query.askingPrice.$gte = Number(minPrice);
      if (maxPrice) query.askingPrice.$lte = Number(maxPrice);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { colorway: { $regex: search, $options: 'i' } }
      ];
    }

    // Sorting
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (sort === 'price-low') sortOption = { askingPrice: 1 };
    if (sort === 'price-high') sortOption = { askingPrice: -1 };
    if (sort === 'oldest') sortOption = { createdAt: 1 };

    const listings = await Listing.find(query)
      .sort(sortOption)
      .limit(50);

    // Mark listings owned by current user
    const formattedListings = listings.map(listing => ({
      id: listing._id,
      sellerId: listing.sellerId,
      sellerUsername: listing.sellerUsername,
      sneakerId: listing.sneakerId,
      name: listing.name,
      brand: listing.brand,
      colorway: listing.colorway,
      styleCode: listing.styleCode,
      size: listing.size,
      condition: listing.condition,
      askingPrice: listing.askingPrice,
      retailPrice: listing.retailPrice,
      description: listing.description,
      image: listing.image,
      status: listing.status,
      isOwner: req.userId ? listing.sellerId.toString() === req.userId : false,
      createdAt: listing.createdAt
    }));

    res.json({
      success: true,
      data: formattedListings,
      count: formattedListings.length
    });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching listings' });
  }
});

/**
 * Get user's own listings
 * GET /api/listings/my
 */
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const listings = await Listing.find({ sellerId: req.userId })
      .sort({ createdAt: -1 });

    const formattedListings = listings.map(listing => ({
      id: listing._id,
      sellerId: listing.sellerId,
      sellerUsername: listing.sellerUsername,
      sneakerId: listing.sneakerId,
      name: listing.name,
      brand: listing.brand,
      colorway: listing.colorway,
      styleCode: listing.styleCode,
      size: listing.size,
      condition: listing.condition,
      askingPrice: listing.askingPrice,
      retailPrice: listing.retailPrice,
      description: listing.description,
      image: listing.image,
      status: listing.status,
      buyerUsername: listing.buyerUsername,
      soldAt: listing.soldAt,
      createdAt: listing.createdAt
    }));

    res.json({
      success: true,
      data: formattedListings,
      count: formattedListings.length
    });
  } catch (error) {
    console.error('Get my listings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching your listings' });
  }
});

/**
 * Get user's purchases
 * GET /api/listings/purchases
 */
router.get('/purchases', authenticateToken, async (req, res) => {
  try {
    const purchases = await Listing.find({ 
      buyerId: req.userId,
      status: 'sold'
    }).sort({ soldAt: -1 });

    const formattedPurchases = purchases.map(listing => ({
      id: listing._id,
      sellerUsername: listing.sellerUsername,
      sneakerId: listing.sneakerId,
      name: listing.name,
      brand: listing.brand,
      colorway: listing.colorway,
      size: listing.size,
      condition: listing.condition,
      askingPrice: listing.askingPrice,
      image: listing.image,
      purchasedAt: listing.soldAt
    }));

    res.json({
      success: true,
      data: formattedPurchases,
      count: formattedPurchases.length
    });
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ success: false, message: 'Error fetching purchases' });
  }
});

/**
 * Get single listing
 * GET /api/listings/:id
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    res.json({
      success: true,
      data: {
        id: listing._id,
        sellerId: listing.sellerId,
        sellerUsername: listing.sellerUsername,
        sneakerId: listing.sneakerId,
        name: listing.name,
        brand: listing.brand,
        colorway: listing.colorway,
        styleCode: listing.styleCode,
        size: listing.size,
        condition: listing.condition,
        askingPrice: listing.askingPrice,
        retailPrice: listing.retailPrice,
        description: listing.description,
        image: listing.image,
        status: listing.status,
        isOwner: req.userId ? listing.sellerId.toString() === req.userId : false,
        createdAt: listing.createdAt
      }
    });
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ success: false, message: 'Error fetching listing' });
  }
});

/**
 * Create a new listing
 * POST /api/listings
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      sneakerId, name, brand, colorway, styleCode, 
      size, condition, askingPrice, retailPrice, 
      description, image 
    } = req.body;

    // Get user info
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Validation
    if (!sneakerId || !name || !brand || !size || !condition || !askingPrice) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: sneakerId, name, brand, size, condition, askingPrice' 
      });
    }

    const listing = new Listing({
      sellerId: req.userId,
      sellerUsername: user.username,
      sneakerId,
      name,
      brand,
      colorway: colorway || '',
      styleCode: styleCode || '',
      size,
      condition,
      askingPrice: Number(askingPrice),
      retailPrice: Number(retailPrice) || 0,
      description: description || '',
      image: image || null,
      status: 'active' // Auto-approve listings
    });

    await listing.save();

    res.status(201).json({
      success: true,
      message: 'Listing created successfully',
      data: {
        id: listing._id,
        name: listing.name,
        brand: listing.brand,
        size: listing.size,
        condition: listing.condition,
        askingPrice: listing.askingPrice
      }
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ success: false, message: 'Error creating listing' });
  }
});

/**
 * Update a listing
 * PUT /api/listings/:id
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // Check ownership
    if (listing.sellerId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this listing' });
    }

    // Can only update active listings
    if (listing.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Cannot update a sold or cancelled listing' });
    }

    const { size, condition, askingPrice, description } = req.body;

    if (size) listing.size = size;
    if (condition) listing.condition = condition;
    if (askingPrice) listing.askingPrice = Number(askingPrice);
    if (description !== undefined) listing.description = description;

    await listing.save();

    res.json({
      success: true,
      message: 'Listing updated successfully',
      data: {
        id: listing._id,
        size: listing.size,
        condition: listing.condition,
        askingPrice: listing.askingPrice,
        description: listing.description
      }
    });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({ success: false, message: 'Error updating listing' });
  }
});

/**
 * Delete/Cancel a listing
 * DELETE /api/listings/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // Check ownership
    if (listing.sellerId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this listing' });
    }

    // Can only delete active listings
    if (listing.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Cannot delete a sold listing' });
    }

    listing.status = 'cancelled';
    await listing.save();

    res.json({
      success: true,
      message: 'Listing cancelled successfully'
    });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ success: false, message: 'Error deleting listing' });
  }
});

/**
 * Buy a listing
 * POST /api/listings/:id/buy
 */
router.post('/:id/buy', authenticateToken, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // Check if listing is still active
    if (listing.status !== 'active') {
      return res.status(400).json({ success: false, message: 'This listing is no longer available' });
    }

    // Can't buy your own listing
    if (listing.sellerId.toString() === req.userId) {
      return res.status(400).json({ success: false, message: 'You cannot buy your own listing' });
    }

    // Get buyer info
    const buyer = await User.findById(req.userId);
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }

    // Mark as sold
    listing.status = 'sold';
    listing.buyerId = req.userId;
    listing.buyerUsername = buyer.username;
    listing.soldAt = new Date();
    await listing.save();

    res.json({
      success: true,
      message: 'Purchase successful! The seller will be notified.',
      data: {
        id: listing._id,
        name: listing.name,
        brand: listing.brand,
        size: listing.size,
        askingPrice: listing.askingPrice,
        sellerUsername: listing.sellerUsername
      }
    });
  } catch (error) {
    console.error('Buy listing error:', error);
    res.status(500).json({ success: false, message: 'Error processing purchase' });
  }
});

/**
 * Get marketplace stats
 * GET /api/listings/stats/overview
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const totalActive = await Listing.countDocuments({ status: 'active' });
    const totalSold = await Listing.countDocuments({ status: 'sold' });
    
    const avgPrice = await Listing.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, avgPrice: { $avg: '$askingPrice' } } }
    ]);

    const topBrands = await Listing.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      data: {
        totalActive,
        totalSold,
        avgPrice: avgPrice[0]?.avgPrice ? Math.round(avgPrice[0].avgPrice) : 0,
        topBrands: topBrands.map(b => ({ brand: b._id, count: b.count }))
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Listing = require('../models/Listing');
const Message = require('../models/Message');
const Payment = require('../models/Payment');
const { authenticateToken } = require('../middleware/auth');

const REVENUE_CUTOFF_DATE = new Date(process.env.REVENUE_CUTOFF_DATE || '2026-04-14T00:00:00.000Z');

const getRevenueStartDate = (startDate) => {
  return startDate > REVENUE_CUTOFF_DATE ? startDate : REVENUE_CUTOFF_DATE;
};

// Admin middleware
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const normalizeRevenuePlanLabel = (plan) => {
  const normalized = String(plan || '').toLowerCase();
  if (!normalized) return 'basic';
  if (normalized === 'free') return 'free';
  return 'basic';
};

// ==================== DASHBOARD STATS ====================

router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminCount = await User.countDocuments({ isAdmin: true });
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: weekAgo } });
    const premiumUsers = await User.countDocuments({ 'subscription.type': { $ne: 'free' }, 'subscription.status': 'active' });

    // Subscription revenue stats
    const now = new Date();
    const activeSubscribers = await User.countDocuments({
      'subscription.type': { $ne: 'free' },
      'subscription.status': 'active',
      'subscription.endDate': { $gt: now }
    });

    const activeByPlan = await User.aggregate([
      {
        $match: {
          'subscription.type': { $ne: 'free' },
          'subscription.status': 'active',
          'subscription.endDate': { $gt: now }
        }
      },
      {
        $group: {
          _id: '$subscription.type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const activeByPlanMap = activeByPlan.reduce((acc, item) => {
      const key = item._id || 'unknown';
      acc[key] = item.count;
      return acc;
    }, {});

    const expiredSubscribers = await User.countDocuments({
      'subscription.type': { $ne: 'free' },
      'subscription.endDate': { $lte: now }
    });

    const freeUsers = await User.countDocuments({
      $or: [
        { 'subscription.type': 'free' },
        { 'subscription.type': { $exists: false } },
        { subscription: { $exists: false } }
      ]
    });

    // Payment/revenue aggregation
    const revenueMatch = { status: 'completed', createdAt: { $gte: REVENUE_CUTOFF_DATE } };

    const completedPayments = await Payment.aggregate([
      { $match: revenueMatch },
      { $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        count: { $sum: 1 },
        avgPayment: { $avg: '$amount' }
      }}
    ]);
    const paymentStats = completedPayments[0] || { totalRevenue: 0, count: 0, avgPayment: 0 };

    // Monthly revenue (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyRevenueStart = getRevenueStartDate(sixMonthsAgo);
    const monthlyRevenue = await Payment.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: monthlyRevenueStart } } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        revenue: { $sum: '$amount' },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Revenue by plan type
    const revenueByPlan = await Payment.aggregate([
      { $match: revenueMatch },
      { $addFields: { normalizedPlan: { $cond: [{ $eq: ['$subscriptionType', 'free'] }, 'free', 'basic'] } } },
      { $group: {
        _id: '$normalizedPlan',
        revenue: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);

    // Recent payments
    const recentPayments = await Payment.find(revenueMatch)
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(10);

    // This month's revenue
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthStart = getRevenueStartDate(monthStart);
    const thisMonthPayments = await Payment.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: thisMonthStart } } },
      { $group: { _id: null, revenue: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const thisMonth = thisMonthPayments[0] || { revenue: 0, count: 0 };

    const totalListings = await Listing.countDocuments();
    const activeListings = await Listing.countDocuments({ status: 'active' });
    const soldListings = await Listing.countDocuments({ status: 'sold' });
    const pendingListings = await Listing.countDocuments({ status: 'pending' });
    const rejectedListings = await Listing.countDocuments({ status: 'rejected' });

    const revenueData = await Listing.aggregate([
      { $match: { status: 'sold' } },
      { $group: { _id: null, totalRevenue: { $sum: '$askingPrice' }, avgPrice: { $avg: '$askingPrice' }, count: { $sum: 1 } } }
    ]);
    const revenue = revenueData[0] || { totalRevenue: 0, avgPrice: 0, count: 0 };

    const totalMessages = await Message.countDocuments();
    const totalConversations = await Message.distinct('conversationId');

    const recentUsers = await User.find()
      .select('username email createdAt isAdmin')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentListings = await Listing.find()
      .select('name brand askingPrice status sellerUsername createdAt image')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentSales = await Listing.find({ status: 'sold' })
      .select('name brand askingPrice sellerUsername buyerUsername soldAt image')
      .sort({ soldAt: -1 })
      .limit(5);

    const topSellers = await Listing.aggregate([
      { $match: { status: 'sold' } },
      { $group: { _id: '$sellerUsername', totalSales: { $sum: '$askingPrice' }, count: { $sum: 1 } } },
      { $sort: { totalSales: -1 } },
      { $limit: 5 }
    ]);

    const brandStats = await Listing.aggregate([
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, admins: adminCount, newThisWeek: newUsersThisWeek, premium: premiumUsers },
        listings: { total: totalListings, active: activeListings, sold: soldListings, pending: pendingListings, rejected: rejectedListings },
        revenue: { total: Math.round(revenue.totalRevenue * 0.05), totalSales: Math.round(revenue.totalRevenue), average: Math.round(revenue.avgPrice), salesCount: revenue.count },
        messages: { total: totalMessages, conversations: totalConversations.length },
        subscriptionRevenue: {
          totalRevenue: Math.round(paymentStats.totalRevenue),
          totalPayments: paymentStats.count,
          avgPayment: Math.round(paymentStats.avgPayment),
          activeSubscribers,
          activeByPlan: activeByPlan.map(p => ({ plan: p._id || 'unknown', count: p.count })),
          premiumCount: activeByPlanMap.premium || 0,
          proCount: activeByPlanMap.pro || 0,
          expiredSubscribers,
          freeUsers,
          thisMonthRevenue: Math.round(thisMonth.revenue),
          thisMonthPayments: thisMonth.count,
          monthlyRevenue: monthlyRevenue.map(m => ({
            month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
            revenue: Math.round(m.revenue),
            count: m.count
          })),
          revenueByPlan: revenueByPlan.map(p => ({ plan: normalizeRevenuePlanLabel(p._id), revenue: Math.round(p.revenue), count: p.count })),
          recentPayments: recentPayments.map(p => ({
            id: p._id,
            username: p.user?.username || p.userDisplayName || 'Deleted User',
            userDisplayName: p.userDisplayName || p.user?.username || '',
            email: p.user?.email || p.userDisplayEmail || '',
            userDisplayEmail: p.userDisplayEmail || p.user?.email || '',
            amount: p.amount,
            plan: normalizeRevenuePlanLabel(p.subscriptionType),
            duration: p.subscriptionDuration,
            date: p.createdAt,
            transactionId: p.khaltiTransactionId
          }))
        },
        recentUsers: recentUsers.map(u => ({ id: u._id, username: u.username, email: u.email, createdAt: u.createdAt, isAdmin: u.isAdmin })),
        recentListings: recentListings.map(l => ({ id: l._id, name: l.name, brand: l.brand, askingPrice: l.askingPrice, status: l.status, sellerUsername: l.sellerUsername, createdAt: l.createdAt, image: l.image })),
        recentSales: recentSales.map(l => ({ id: l._id, name: l.name, brand: l.brand, askingPrice: l.askingPrice, sellerUsername: l.sellerUsername, buyerUsername: l.buyerUsername, soldAt: l.soldAt, image: l.image })),
        topSellers,
        brandStats
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

// ==================== USER MANAGEMENT ====================

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = { $or: [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]};
    }

    const users = await User.find(query).select('-password -twoFactorSecret').sort({ createdAt: -1 });
    const userIds = users.map(u => u._id);
    const listingCounts = await Listing.aggregate([
      { $match: { sellerId: { $in: userIds } } },
      { $group: {
        _id: '$sellerId',
        count: { $sum: 1 },
        sold: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } },
        totalSales: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, '$askingPrice', 0] } },
        revenue: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, { $multiply: ['$askingPrice', 0.05] }, 0] } }
      }}
    ]);
    const countMap = {};
    listingCounts.forEach(lc => { countMap[lc._id.toString()] = lc; });

    res.json({
      success: true,
      data: users.map(user => {
        const isActive = user.subscription?.type !== 'free' &&
                         user.subscription?.status === 'active' &&
                         user.subscription?.endDate &&
                         new Date(user.subscription.endDate) > new Date();
        return {
          id: user._id,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin,
          subscription: user.subscription,
          subscriptionActive: isActive,
          subscriptionDaysLeft: isActive
            ? Math.ceil((new Date(user.subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24))
            : 0,
          freePredictionsUsed: user.freePredictionsUsed || 0,
          twoFactorEnabled: user.twoFactorEnabled,
          createdAt: user.createdAt,
          listingCount: countMap[user._id.toString()]?.count || 0,
          soldCount: countMap[user._id.toString()]?.sold || 0,
          revenue: countMap[user._id.toString()]?.revenue || 0
        };
      })
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

router.get('/users/:id/listings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const listings = await Listing.find({ sellerId: req.params.id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: listings.map(l => ({
        id: l._id, name: l.name, brand: l.brand, size: l.size, condition: l.condition,
        askingPrice: l.askingPrice, status: l.status, image: l.image, createdAt: l.createdAt,
        buyerUsername: l.buyerUsername, soldAt: l.soldAt
      }))
    });
  } catch (error) {
    console.error('Admin get user listings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching user listings' });
  }
});

router.put('/users/:id/toggle-admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, message: 'Cannot change your own admin status' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isAdmin = !user.isAdmin;
    await user.save();
    res.json({ success: true, message: `User ${user.isAdmin ? 'promoted to' : 'removed from'} admin`, isAdmin: user.isAdmin });
  } catch (error) {
    console.error('Toggle admin error:', error);
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
});

router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await Listing.deleteMany({ sellerId: req.params.id });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ success: false, message: 'Error deleting user' });
  }
});

// ==================== LISTINGS MANAGEMENT ====================

router.get('/listings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = {};
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { sellerUsername: { $regex: search, $options: 'i' } }
      ];
    }
    const listings = await Listing.find(query).sort({ createdAt: -1 }).limit(200);
    res.json({
      success: true,
      data: listings.map(l => ({
        id: l._id, name: l.name, brand: l.brand, colorway: l.colorway, size: l.size,
        condition: l.condition, askingPrice: l.askingPrice, retailPrice: l.retailPrice,
        status: l.status, image: l.image, sellerUsername: l.sellerUsername,
        buyerUsername: l.buyerUsername, description: l.description,
        createdAt: l.createdAt, soldAt: l.soldAt
      }))
    });
  } catch (error) {
    console.error('Admin get listings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching listings' });
  }
});

router.put('/listings/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'rejected', 'pending', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const listing = await Listing.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
    res.json({ success: true, message: `Listing ${status === 'active' ? 'approved' : status}`, data: listing });
  } catch (error) {
    console.error('Update listing status error:', error);
    res.status(500).json({ success: false, message: 'Error updating listing' });
  }
});

router.delete('/listings/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const listing = await Listing.findByIdAndDelete(req.params.id);
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
    res.json({ success: true, message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Admin delete listing error:', error);
    res.status(500).json({ success: false, message: 'Error deleting listing' });
  }
});

module.exports = router;

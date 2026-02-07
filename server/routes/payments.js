const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { authenticateToken } = require('../middleware/auth');

// Khalti API configuration
const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || 'test_secret_key_dc74e0fd57cb46cd93832aee0a390234';
const KHALTI_API_URL = 'https://khalti.com/api/v2';

// Subscription plans
const SUBSCRIPTION_PLANS = {
  premium: {
    name: 'Premium',
    price: 299, // NPR
    duration: 30, // days
    features: ['Unlimited predictions', 'Priority support', 'Advanced analytics']
  },
  pro: {
    name: 'Pro',
    price: 799, // NPR
    duration: 90, // days
    features: ['Everything in Premium', 'API access', 'Custom alerts', 'Batch predictions']
  }
};

/**
 * GET /api/payments/plans
 * Get available subscription plans
 */
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    plans: SUBSCRIPTION_PLANS
  });
});

/**
 * GET /api/payments/status
 * Get user's subscription status and remaining predictions
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const now = new Date();
    const isSubscribed = user.subscription?.type !== 'free' && 
                        user.subscription?.status === 'active' &&
                        user.subscription?.endDate && 
                        new Date(user.subscription.endDate) > now;

    res.json({
      success: true,
      subscription: {
        type: user.subscription?.type || 'free',
        status: user.subscription?.status || 'active',
        isActive: isSubscribed,
        endDate: user.subscription?.endDate,
        daysRemaining: isSubscribed ? 
          Math.ceil((new Date(user.subscription.endDate) - now) / (1000 * 60 * 60 * 24)) : 0
      },
      predictions: {
        used: user.freePredictionsUsed || 0,
        remaining: user.getRemainingFreePredictions(),
        limit: 5,
        unlimited: isSubscribed
      }
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

/**
 * POST /api/payments/check-prediction
 * Check if user can make a prediction (called before prediction)
 */
router.post('/check-prediction', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const canPredict = await user.canMakeFreePrediction();
    const remaining = user.getRemainingFreePredictions();

    res.json({
      success: true,
      canPredict,
      remaining,
      requiresSubscription: !canPredict,
      message: canPredict ? 
        `You have ${remaining === -1 ? 'unlimited' : remaining} predictions remaining` :
        'You have used all free predictions. Please subscribe to continue.'
    });
  } catch (error) {
    console.error('Check prediction error:', error);
    res.status(500).json({ success: false, error: 'Failed to check prediction status' });
  }
});

/**
 * POST /api/payments/use-prediction
 * Record a prediction usage
 */
router.post('/use-prediction', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const canPredict = await user.canMakeFreePrediction();
    if (!canPredict) {
      return res.status(403).json({ 
        success: false, 
        error: 'Prediction limit reached',
        requiresSubscription: true 
      });
    }

    await user.incrementPredictionCount();

    res.json({
      success: true,
      remaining: user.getRemainingFreePredictions(),
      message: 'Prediction recorded'
    });
  } catch (error) {
    console.error('Use prediction error:', error);
    res.status(500).json({ success: false, error: 'Failed to record prediction' });
  }
});

/**
 * POST /api/payments/initiate
 * Initiate Khalti payment
 */
router.post('/initiate', authenticateToken, async (req, res) => {
  try {
    const { planType } = req.body;
    
    if (!planType || !SUBSCRIPTION_PLANS[planType]) {
      return res.status(400).json({ success: false, error: 'Invalid plan type' });
    }

    const plan = SUBSCRIPTION_PLANS[planType];
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Generate unique purchase order ID
    const purchaseOrderId = `DRP-${user._id}-${Date.now()}`;

    // Khalti payment initiation payload
    const payload = {
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription/verify`,
      website_url: process.env.FRONTEND_URL || 'http://localhost:5173',
      amount: plan.price * 100, // Khalti expects paisa (multiply by 100)
      purchase_order_id: purchaseOrderId,
      purchase_order_name: `Driplytics ${plan.name} Subscription`,
      customer_info: {
        name: user.username,
        email: user.email
      }
    };

    // Call Khalti API to initiate payment
    const response = await axios.post(
      `${KHALTI_API_URL}/epayment/initiate/`,
      payload,
      {
        headers: {
          'Authorization': `Key ${KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Create pending payment record
    const payment = new Payment({
      user: user._id,
      khaltiTransactionId: purchaseOrderId,
      khaltiIdx: response.data.pidx,
      amount: plan.price,
      subscriptionType: planType,
      subscriptionDuration: plan.duration,
      status: 'pending'
    });
    await payment.save();

    res.json({
      success: true,
      paymentUrl: response.data.payment_url,
      pidx: response.data.pidx,
      purchaseOrderId
    });

  } catch (error) {
    console.error('Payment initiation error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initiate payment',
      details: error.response?.data || error.message
    });
  }
});

/**
 * POST /api/payments/verify
 * Verify Khalti payment after redirect
 */
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { pidx, txnId, amount, purchaseOrderId } = req.body;

    if (!pidx) {
      return res.status(400).json({ success: false, error: 'Payment ID required' });
    }

    // Verify payment with Khalti
    const response = await axios.post(
      `${KHALTI_API_URL}/epayment/lookup/`,
      { pidx },
      {
        headers: {
          'Authorization': `Key ${KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const paymentData = response.data;

    // Find the payment record
    const payment = await Payment.findOne({ khaltiIdx: pidx });
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }

    // Check if payment is successful
    if (paymentData.status === 'Completed') {
      // Update payment record
      payment.status = 'completed';
      payment.khaltiTransactionId = paymentData.transaction_id || pidx;
      await payment.save();

      // Update user subscription
      const user = await User.findById(payment.user);
      const plan = SUBSCRIPTION_PLANS[payment.subscriptionType];
      
      const now = new Date();
      const endDate = new Date(now.getTime() + (plan.duration * 24 * 60 * 60 * 1000));

      user.subscription = {
        type: payment.subscriptionType,
        status: 'active',
        startDate: now,
        endDate: endDate,
        khaltiTransactionId: paymentData.transaction_id || pidx
      };
      user.freePredictionsUsed = 0; // Reset prediction count
      await user.save();

      res.json({
        success: true,
        message: 'Payment verified successfully',
        subscription: {
          type: payment.subscriptionType,
          startDate: now,
          endDate: endDate,
          daysRemaining: plan.duration
        }
      });
    } else {
      payment.status = 'failed';
      payment.errorMessage = `Payment status: ${paymentData.status}`;
      await payment.save();

      res.status(400).json({
        success: false,
        error: 'Payment not completed',
        status: paymentData.status
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify payment',
      details: error.response?.data || error.message
    });
  }
});

/**
 * GET /api/payments/history
 * Get user's payment history
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      payments: payments.map(p => ({
        id: p._id,
        amount: p.amount,
        subscriptionType: p.subscriptionType,
        status: p.status,
        date: p.createdAt,
        transactionId: p.khaltiTransactionId
      }))
    });
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payment history' });
  }
});

module.exports = router;

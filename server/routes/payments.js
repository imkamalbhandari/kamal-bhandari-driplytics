const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { authenticateToken } = require('../middleware/auth');

// Khalti ePayment API (docs: https://docs.khalti.com/khalti-epayment/)
// Sandbox: https://dev.khalti.com/api/v2/ | Key from https://test-admin.khalti.com
// Production: https://khalti.com/api/v2/ | Key from https://admin.khalti.com
// Sandbox test: OTP 987654, Khalti IDs 9800000000–9800000005, MPIN 1111
const rawKhaltiSecretKey = (
  process.env.KHALTI_SECRET_KEY ||
  process.env.KHALTI_LIVE_SECRET_KEY ||
  process.env.KHALTI_TEST_SECRET_KEY ||
  ''
).trim();
const KHALTI_SECRET_KEY = rawKhaltiSecretKey.replace(/^Key\s+/i, '').trim();
const khaltiApiUrlFromEnv = (process.env.KHALTI_API_URL || '').trim().replace(/\/$/, '');

const sandboxFlagFromEnv =
  process.env.KHALTI_SANDBOX === 'true'
    ? true
    : process.env.KHALTI_SANDBOX === 'false'
    ? false
    : null;

const sandboxFlagFromKey =
  /^test_/i.test(KHALTI_SECRET_KEY) || /sandbox|dev/i.test(KHALTI_SECRET_KEY)
    ? true
    : /^live_/i.test(KHALTI_SECRET_KEY)
    ? false
    : null;

const KHALTI_SANDBOX =
  sandboxFlagFromEnv ?? sandboxFlagFromKey ?? process.env.NODE_ENV !== 'production';

const KHALTI_API_URL =
  khaltiApiUrlFromEnv ||
  (KHALTI_SANDBOX ? 'https://dev.khalti.com/api/v2' : 'https://khalti.com/api/v2');

const KHALTI_ALT_API_URL = KHALTI_API_URL.includes('dev.khalti.com')
  ? 'https://khalti.com/api/v2'
  : 'https://dev.khalti.com/api/v2';

const buildKhaltiHeaders = () => ({
  Authorization: `Key ${KHALTI_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

const shouldRetryWithAlternateUrl = (error) => {
  return error?.response?.status === 401 && !khaltiApiUrlFromEnv;
};

const khaltiPost = async (endpoint, payload) => {
  try {
    return await axios.post(`${KHALTI_API_URL}${endpoint}`, payload, {
      headers: buildKhaltiHeaders()
    });
  } catch (error) {
    if (!shouldRetryWithAlternateUrl(error)) {
      throw error;
    }

    console.warn(`Khalti 401 on ${KHALTI_API_URL}; retrying with ${KHALTI_ALT_API_URL}`);
    return axios.post(`${KHALTI_ALT_API_URL}${endpoint}`, payload, {
      headers: buildKhaltiHeaders()
    });
  }
};

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
    const user = await User.findById(req.userId);
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
    const user = await User.findById(req.userId);
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
    const user = await User.findById(req.userId);
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
 * Initiate Khalti ePayment (Web Checkout). User is redirected to payment_url.
 */
router.post('/initiate', authenticateToken, async (req, res) => {
  try {
    if (!KHALTI_SECRET_KEY) {
      return res.status(503).json({ success: false, error: 'Khalti is not configured. Set KHALTI_SECRET_KEY in .env' });
    }

    const { planType } = req.body;
    if (!planType || !SUBSCRIPTION_PLANS[planType]) {
      return res.status(400).json({ success: false, error: 'Invalid plan type' });
    }

    const plan = SUBSCRIPTION_PLANS[planType];
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const purchaseOrderId = `DRP-${user._id}-${Date.now()}`;
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const amountPaisa = Math.round(plan.price * 100); // Khalti expects paisa; min 1000 (Rs 10)
    if (amountPaisa < 1000) {
      return res.status(400).json({ success: false, error: 'Amount must be at least Rs 10' });
    }

    const payload = {
      return_url: `${frontendUrl}/subscription/verify`,
      website_url: frontendUrl,
      amount: amountPaisa,
      purchase_order_id: purchaseOrderId,
      purchase_order_name: `Driplytics ${plan.name} (${plan.duration} days)`,
      customer_info: {
        name: user.username || 'Customer',
        email: user.email,
        phone: '9800000000' // Sandbox test IDs: 9800000000–9800000005
      }
    };

    const response = await khaltiPost('/epayment/initiate/', payload);

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
      expires_in: response.data.expires_in,
      purchaseOrderId
    });
  } catch (error) {
    const details = error.response?.data;
    console.error('Payment initiation error:', details || error.message);
    const isKhaltiAuthError = error.response?.status === 401;
    res.status(isKhaltiAuthError ? 401 : 500).json({
      success: false,
      error: isKhaltiAuthError
        ? 'Khalti authentication failed. Check KHALTI_SECRET_KEY and KHALTI_SANDBOX in server/.env.'
        : details?.detail || details?.amount?.[0] || 'Failed to initiate payment',
      details: details
    });
  }
});

/**
 * POST /api/payments/verify
 * Verify Khalti payment via lookup API after user is redirected to return_url.
 * Only status "Completed" is treated as success (per Khalti docs).
 */
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    if (!KHALTI_SECRET_KEY) {
      return res.status(503).json({ success: false, error: 'Khalti is not configured' });
    }

    const { pidx, status: callbackStatus } = req.body;
    if (!pidx) {
      return res.status(400).json({ success: false, error: 'Payment ID (pidx) required' });
    }

    // Lookup payment with Khalti (required for confirmation per docs)
    const lookupRes = await khaltiPost('/epayment/lookup/', { pidx });

    const paymentData = lookupRes.data;
    const payment = await Payment.findOne({ khaltiIdx: pidx });
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }

    const status = paymentData.status;

    // Only "Completed" = success (Khalti docs)
    if (status === 'Completed') {
      payment.status = 'completed';
      payment.khaltiTransactionId = paymentData.transaction_id || pidx;
      payment.errorMessage = undefined;
      await payment.save();

      const user = await User.findById(payment.user);
      const plan = SUBSCRIPTION_PLANS[payment.subscriptionType];
      const now = new Date();
      const endDate = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);

      user.subscription = {
        type: payment.subscriptionType,
        status: 'active',
        startDate: now,
        endDate: endDate,
        khaltiTransactionId: paymentData.transaction_id || pidx
      };
      user.freePredictionsUsed = 0;
      await user.save();

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        subscription: {
          type: payment.subscriptionType,
          startDate: now,
          endDate: endDate,
          daysRemaining: plan.duration
        }
      });
    }

    // Failed / non-success statuses
    payment.status = 'failed';
    payment.errorMessage = status;
    await payment.save();

    const userFacingMessage =
      status === 'User canceled'
        ? 'Payment was canceled.'
        : status === 'Expired'
        ? 'Payment link expired. Please try again.'
        : status === 'Pending' || status === 'Initiated'
        ? 'Payment is still pending. Please wait or contact support.'
        : status === 'Refunded' || status === 'Partially Refunded'
        ? 'This payment was refunded.'
        : `Payment not completed (${status}).`;

    res.status(400).json({
      success: false,
      error: userFacingMessage,
      status
    });
  } catch (error) {
    const details = error.response?.data;
    const isInvalidPidx = details?.error_key === 'validation_error' || details?.detail === 'Not found.';
    const isAuth = error.response?.status === 401;
    console.error('Payment verification error:', details || error.message);
    res.status(isAuth ? 401 : isInvalidPidx ? 404 : 500).json({
      success: false,
      error: details?.detail || 'Failed to verify payment',
      details: details
    });
  }
});

/**
 * GET /api/payments/history
 * Get user's payment history
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.userId })
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

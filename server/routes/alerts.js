const express = require('express');
const router = express.Router();
const axios = require('axios');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { sendAlertEmail } = require('../services/emailService');
const { sendAlertSMS } = require('../services/smsService');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';

// ==================== CRUD OPERATIONS ====================

/**
 * Create a new price alert
 * POST /api/alerts
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { sneakerName, brand, retailPrice, currentPrice, targetPrice, alertType, phoneNumber, notifyEmail, notifyPhone } = req.body;

    if (!sneakerName || !targetPrice) {
      return res.status(400).json({ success: false, message: 'Sneaker name and target price are required' });
    }

    // Limit alerts per user (max 20)
    const existingCount = await Alert.countDocuments({ userId: req.userId });
    if (existingCount >= 20) {
      return res.status(400).json({ success: false, message: 'Maximum 20 alerts allowed. Please remove some first.' });
    }

    const alert = new Alert({
      userId: req.userId,
      sneakerName,
      brand: brand || '',
      retailPrice: retailPrice || 0,
      currentPrice: currentPrice || 0,
      predictedPrice: 0,
      targetPrice: parseFloat(targetPrice),
      alertType: alertType || 'below',
      phoneNumber: phoneNumber || null,
      notifyEmail: notifyEmail !== false,
      notifyPhone: !!notifyPhone && !!phoneNumber,
    });

    await alert.save();

    res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      alert
    });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to create alert' });
  }
});

/**
 * Get all alerts for the authenticated user
 * GET /api/alerts
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, alerts });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
  }
});

/**
 * Toggle alert enable/disable
 * PUT /api/alerts/:id/toggle
 */
router.put('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.id, userId: req.userId });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    alert.enabled = !alert.enabled;
    // If re-enabling a triggered alert, reset triggered state
    if (alert.enabled && alert.triggered) {
      alert.triggered = false;
      alert.triggeredAt = null;
    }
    await alert.save();

    res.json({ success: true, alert });
  } catch (error) {
    console.error('Toggle alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle alert' });
  }
});

/**
 * Update alert (phone number, target price, etc.)
 * PUT /api/alerts/:id
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.id, userId: req.userId });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    const { targetPrice, alertType, phoneNumber, notifyEmail, notifyPhone } = req.body;

    if (targetPrice !== undefined) alert.targetPrice = parseFloat(targetPrice);
    if (alertType !== undefined) alert.alertType = alertType;
    if (phoneNumber !== undefined) alert.phoneNumber = phoneNumber;
    if (notifyEmail !== undefined) alert.notifyEmail = notifyEmail;
    if (notifyPhone !== undefined) alert.notifyPhone = notifyPhone;

    await alert.save();

    res.json({ success: true, alert });
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to update alert' });
  }
});

/**
 * Delete an alert
 * DELETE /api/alerts/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const alert = await Alert.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    res.json({ success: true, message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete alert' });
  }
});

// ==================== PRICE CHECK & NOTIFICATION ====================

/**
 * Manually check alerts (also called by cron job)
 * POST /api/alerts/check
 */
router.post('/check', authenticateToken, async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.userId, enabled: true, triggered: false });

    if (alerts.length === 0) {
      return res.json({ success: true, message: 'No active alerts to check', checked: 0, triggered: 0 });
    }

    const user = await User.findById(req.userId).select('email username');
    const results = await checkAlerts(alerts, user);

    res.json({
      success: true,
      message: `Checked ${results.checked} alerts, ${results.triggered} triggered`,
      ...results
    });
  } catch (error) {
    console.error('Check alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to check alerts' });
  }
});

/**
 * Core function: Check alerts against predicted prices and send notifications
 */
async function checkAlerts(alerts, user) {
  let checked = 0;
  let triggered = 0;
  const triggeredAlerts = [];

  for (const alert of alerts) {
    try {
      // Get fresh predicted price from ML service
      const predictedPrice = await getPredictedPrice(alert.sneakerName, alert.brand, alert.retailPrice);

      if (predictedPrice === null) {
        console.log(`Could not get prediction for: ${alert.sneakerName}`);
        continue;
      }

      checked++;

      // Update alert with latest predicted price
      alert.predictedPrice = predictedPrice;
      alert.lastChecked = new Date();
      alert.priceHistory.push({
        price: alert.currentPrice,
        predictedPrice: predictedPrice,
        checkedAt: new Date()
      });

      // Keep only last 30 price history entries
      if (alert.priceHistory.length > 30) {
        alert.priceHistory = alert.priceHistory.slice(-30);
      }

      // Check if alert condition is met
      const isTriggered =
        (alert.alertType === 'below' && predictedPrice <= alert.targetPrice) ||
        (alert.alertType === 'above' && predictedPrice >= alert.targetPrice);

      if (isTriggered) {
        alert.triggered = true;
        alert.triggeredAt = new Date();
        triggered++;
        triggeredAlerts.push(alert);

        // Send notifications
        if (user) {
          await sendNotifications(alert, user, predictedPrice);
        }
      }

      await alert.save();
    } catch (error) {
      console.error(`Error checking alert ${alert._id}:`, error.message);
    }
  }

  return { checked, triggered, triggeredAlerts };
}

/**
 * Get predicted price from ML service using the quick prediction endpoint
 */
async function getPredictedPrice(sneakerName, brand, retailPrice) {
  try {
    // Try predict-best-price/quick endpoint first (fast ML-only prediction)
    const response = await axios.post(`${ML_SERVICE_URL}/predict-best-price/quick`, {
      sneaker_name: sneakerName,
      brand: brand || '',
      retail_price: retailPrice || 200,
    }, { timeout: 15000 });

    if (response.data?.success && response.data?.prediction?.best_predicted_price) {
      return response.data.prediction.best_predicted_price;
    }

    // Fallback: try regular predict endpoint
    const fallbackResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
      brand: brand || 'Nike',
      retail_price: retailPrice || 200,
      gender: 'Men',
      release_date: '2024-01-01',
      volatility: 0.5
    }, { timeout: 10000 });

    if (fallbackResponse.data?.predicted_price) {
      return fallbackResponse.data.predicted_price;
    }

    return null;
  } catch (error) {
    console.error(`ML prediction failed for ${sneakerName}:`, error.message);
    return null;
  }
}

/**
 * Send notifications (email + phone alert email) when alert is triggered
 */
async function sendNotifications(alert, user, predictedPrice) {
  const direction = alert.alertType === 'below' ? 'fallen below' : 'risen above';

  // Email notification
  if (alert.notifyEmail && user.email) {
    try {
      await sendAlertEmail(user.email, {
        username: user.username,
        sneakerName: alert.sneakerName,
        targetPrice: alert.targetPrice,
        predictedPrice: predictedPrice,
        alertType: alert.alertType,
        direction,
        phoneNumber: alert.notifyPhone ? alert.phoneNumber : null
      });
      alert.emailStatus = 'sent';
      console.log(`[EMAIL] Alert sent to ${user.email} for ${alert.sneakerName}`);
    } catch (error) {
      alert.emailStatus = 'failed';
      console.error('[EMAIL] Failed:', error.message);
    }
  } else {
    alert.emailStatus = 'not_configured';
  }

  // SMS / Phone notification
  if (alert.notifyPhone && alert.phoneNumber) {
    try {
      const smsResult = await sendAlertSMS(alert.phoneNumber, {
        sneakerName: alert.sneakerName,
        targetPrice: alert.targetPrice,
        predictedPrice: predictedPrice,
        alertType: alert.alertType,
        direction,
      });
      if (smsResult.success) {
        alert.smsStatus = 'sent';
        console.log(`[SMS] Alert sent to ${alert.phoneNumber} for ${alert.sneakerName}`);
      } else {
        alert.smsStatus = 'failed';
        console.error(`[SMS] Failed for ${alert.phoneNumber}: ${smsResult.error}`);
      }
    } catch (error) {
      alert.smsStatus = 'failed';
      console.error('[SMS] Failed:', error.message);
    }
  } else {
    alert.smsStatus = 'not_configured';
  }
}

// ==================== CRON JOB: Periodic Alert Checking ====================

/**
 * This function is called by node-cron from index.js
 * It checks ALL active (enabled, non-triggered) alerts
 */
async function checkAllAlerts() {
  console.log('[Alert Cron] Starting alert check...');

  try {
    const alerts = await Alert.find({ enabled: true, triggered: false });

    if (alerts.length === 0) {
      console.log('[Alert Cron] No active alerts to check');
      return;
    }

    console.log(`[Alert Cron] Checking ${alerts.length} active alerts...`);

    // Group alerts by userId so we can send batch notifications
    const alertsByUser = {};
    for (const alert of alerts) {
      const uid = alert.userId.toString();
      if (!alertsByUser[uid]) alertsByUser[uid] = [];
      alertsByUser[uid].push(alert);
    }

    let totalChecked = 0;
    let totalTriggered = 0;

    for (const [userId, userAlerts] of Object.entries(alertsByUser)) {
      try {
        const user = await User.findById(userId).select('email username');
        if (!user) continue;

        const result = await checkAlerts(userAlerts, user);
        totalChecked += result.checked;
        totalTriggered += result.triggered;
      } catch (error) {
        console.error(`[Alert Cron] Error checking alerts for user ${userId}:`, error.message);
      }
    }

    console.log(`[Alert Cron] Done. Checked: ${totalChecked}, Triggered: ${totalTriggered}`);
  } catch (error) {
    console.error('[Alert Cron] Fatal error:', error);
  }
}

module.exports = router;
module.exports.checkAllAlerts = checkAllAlerts;

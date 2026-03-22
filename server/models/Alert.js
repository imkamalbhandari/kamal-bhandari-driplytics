const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sneakerName: {
    type: String,
    required: [true, 'Sneaker name is required'],
    trim: true
  },
  brand: {
    type: String,
    default: ''
  },
  retailPrice: {
    type: Number,
    default: 0
  },
  // The price at the time the alert was created (from AvgSalePrice)
  currentPrice: {
    type: Number,
    default: 0
  },
  // Latest predicted price (updated by cron job)
  predictedPrice: {
    type: Number,
    default: 0
  },
  // The user's target price to trigger the alert
  targetPrice: {
    type: Number,
    required: [true, 'Target price is required']
  },
  // 'below' = alert when predicted price falls below target
  // 'above' = alert when predicted price goes above target
  alertType: {
    type: String,
    enum: ['below', 'above'],
    default: 'below'
  },
  // Notification method
  notifyEmail: {
    type: Boolean,
    default: true
  },
  notifyPhone: {
    type: Boolean,
    default: false
  },
  phoneNumber: {
    type: String,
    default: null,
    trim: true
  },
  // Alert status
  enabled: {
    type: Boolean,
    default: true
  },
  triggered: {
    type: Boolean,
    default: false
  },
  triggeredAt: {
    type: Date,
    default: null
  },
  // Last time the predicted price was checked
  lastChecked: {
    type: Date,
    default: null
  },
  // History of price checks
  priceHistory: [{
    price: Number,
    predictedPrice: Number,
    checkedAt: { type: Date, default: Date.now }
  }],
  // Notification delivery status
  emailStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'not_configured'],
    default: 'pending'
  },
  smsStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'not_configured'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
alertSchema.index({ enabled: 1, triggered: 1 });

module.exports = mongoose.model('Alert', alertSchema);

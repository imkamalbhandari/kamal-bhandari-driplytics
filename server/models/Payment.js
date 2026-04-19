const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userDisplayName: {
    type: String,
    default: ''
  },
  userDisplayEmail: {
    type: String,
    default: ''
  },
  // Khalti payment details
  khaltiTransactionId: {
    type: String,
    required: true,
    unique: true
  },
  khaltiToken: String,
  khaltiIdx: String,
  
  // Payment info
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'NPR'
  },
  
  // Subscription details
  subscriptionType: {
    type: String,
    enum: ['basic', 'premium', 'pro'],
    required: true
  },
  subscriptionDuration: {
    type: Number, // in days
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  
  // Metadata
  paymentMethod: {
    type: String,
    default: 'khalti'
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  
  // Error tracking
  errorMessage: String
}, {
  timestamps: true
});

// Index for faster queries
paymentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);

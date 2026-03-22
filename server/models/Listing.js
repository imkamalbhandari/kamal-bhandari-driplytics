const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sellerUsername: {
    type: String,
    required: true
  },
  sneakerId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: true
  },
  colorway: {
    type: String,
    default: ''
  },
  styleCode: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    required: true
  },
  condition: {
    type: String,
    enum: ['new', 'like-new', 'good', 'fair'],
    required: true
  },
  askingPrice: {
    type: Number,
    required: true
  },
  retailPrice: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'sold', 'cancelled', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    default: null
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  buyerUsername: {
    type: String,
    default: null
  },
  soldAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
listingSchema.index({ status: 1, createdAt: -1 });
listingSchema.index({ sellerId: 1 });
listingSchema.index({ brand: 1 });
listingSchema.index({ name: 'text', brand: 'text', colorway: 'text' });

const Listing = mongoose.model('Listing', listingSchema);

module.exports = Listing;

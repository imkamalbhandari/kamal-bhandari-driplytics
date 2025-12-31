const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  retailPrice: {
    type: Number,
    default: 0
  },
  releaseDate: {
    type: String,
    default: ''
  },
  savedPrice: {
    type: Number,
    default: 0
  },
  gender: {
    type: String,
    default: 'men'
  },
  volatility: {
    type: Number,
    default: 0.15
  }
}, {
  timestamps: true
});

// Ensure a user can only favorite a sneaker once
favoriteSchema.index({ userId: 1, sneakerId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  // Profile picture
  profilePicture: {
    type: String,
    default: null
  },
  // Admin flag
  isAdmin: {
    type: Boolean,
    default: false
  },
  // Two-Factor Authentication
  twoFactorSecret: {
    type: String,
    default: null
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  // Subscription & Payment
  subscription: {
    type: {
      type: String,
      enum: ['free', 'basic', 'premium', 'pro'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active'
    },
    startDate: Date,
    endDate: Date,
    khaltiTransactionId: String
  },
  // Free tier prediction limit tracking
  freePredictionsUsed: {
    type: Number,
    default: 0
  },
  freePredictionsResetDate: {
    type: Date,
    default: Date.now
  },
  // Search history tracking
  searchHistory: [{
    query: String,
    timestamp: { type: Date, default: Date.now },
    resultCount: Number
  }],
  // Prediction history tracking
  predictionHistory: [{
    sneakerId: String,
    sneakerName: String,
    predictedPrice: Number,
    confidence: Number,
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user can make free prediction
userSchema.methods.canMakeFreePrediction = async function() {
  const FREE_LIMIT = 5;
  const now = new Date();
  const resetDate = new Date(this.freePredictionsResetDate);
  
  // Reset monthly - save the reset
  if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
    this.freePredictionsUsed = 0;
    this.freePredictionsResetDate = now;
    await this.save();
    return true;
  }
  
  // Check if premium subscriber
  if (this.subscription?.type !== 'free' && this.subscription?.status === 'active') {
    if (this.subscription.endDate && new Date(this.subscription.endDate) > now) {
      return true; // Premium user - unlimited
    }
  }
  
  return this.freePredictionsUsed < FREE_LIMIT;
};

// Method to increment prediction count (by 1 or more for batch)
userSchema.methods.incrementPredictionCount = async function(count = 1) {
  this.freePredictionsUsed = (this.freePredictionsUsed || 0) + Math.max(1, count);
  await this.save();
};

// Method to get remaining free predictions
userSchema.methods.getRemainingFreePredictions = function() {
  const FREE_LIMIT = 5;
  if (this.subscription?.type !== 'free' && this.subscription?.status === 'active') {
    return -1; // Unlimited for premium
  }
  return Math.max(0, FREE_LIMIT - this.freePredictionsUsed);
};

module.exports = mongoose.model('User', userSchema);


import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: async (username, email, password) => {
    try {
      const response = await api.post('/auth/register', {
        username,
        email,
        password,
      });
      return response.data;
    } catch (error) {
      // Better error handling
      if (error.response) {
        // Server responded with error
        throw error;
      } else if (error.request) {
        // Request made but no response (server not running or network issue)
        throw new Error('Cannot connect to server. Please make sure the backend server is running on port 5000.');
      } else {
        // Something else happened
        throw new Error('An unexpected error occurred: ' + error.message);
      }
    }
  },

  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });
      return response.data;
    } catch (error) {
      // Better error handling
      if (error.response) {
        // Server responded with error
        throw error;
      } else if (error.request) {
        // Request made but no response (server not running or network issue)
        throw new Error('Cannot connect to server. Please make sure the backend server is running on port 5000.');
      } else {
        // Something else happened
        throw new Error('An unexpected error occurred: ' + error.message);
      }
    }
  },

  forgotPassword: async (email) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw error;
      } else if (error.request) {
        throw new Error('Cannot connect to server. Please make sure the backend server is running on port 5000.');
      } else {
        throw new Error('An unexpected error occurred: ' + error.message);
      }
    }
  },

  verifyOTP: async (email, otp) => {
    try {
      const response = await api.post('/auth/verify-otp', { email, otp });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw error;
      } else if (error.request) {
        throw new Error('Cannot connect to server. Please make sure the backend server is running on port 5000.');
      } else {
        throw new Error('An unexpected error occurred: ' + error.message);
      }
    }
  },

  resetPassword: async (resetToken, newPassword) => {
    try {
      const response = await api.post('/auth/reset-password', {
        resetToken,
        newPassword,
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw error;
      } else if (error.request) {
        throw new Error('Cannot connect to server. Please make sure the backend server is running on port 5000.');
      } else {
        throw new Error('An unexpected error occurred: ' + error.message);
      }
    }
  },

  // Get user profile with stats
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  // Update user profile
  updateProfile: async (username, email) => {
    const response = await api.put('/auth/profile', { username, email });
    return response.data;
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  },

  // ==================== TWO-FACTOR AUTHENTICATION ====================
  
  // Setup 2FA - returns QR code
  setup2FA: async () => {
    const response = await api.post('/auth/2fa/setup');
    return response.data;
  },

  // Verify and enable 2FA
  verify2FA: async (token) => {
    const response = await api.post('/auth/2fa/verify', { token });
    return response.data;
  },

  // Disable 2FA
  disable2FA: async (password, token) => {
    const response = await api.post('/auth/2fa/disable', { password, token });
    return response.data;
  },

  // Get 2FA status
  get2FAStatus: async () => {
    const response = await api.get('/auth/2fa/status');
    return response.data;
  },

  // Validate 2FA during login
  validate2FA: async (email, token) => {
    const response = await api.post('/auth/2fa/validate', { email, token });
    return response.data;
  },

  // ==================== SEARCH & PREDICTION HISTORY ====================

  // Add to search history
  addSearchHistory: async (query, resultCount) => {
    const response = await api.post('/auth/search-history', { query, resultCount });
    return response.data;
  },

  // Get search history
  getSearchHistory: async () => {
    const response = await api.get('/auth/search-history');
    return response.data;
  },

  // Add to prediction history
  addPredictionHistory: async (sneakerId, sneakerName, predictedPrice, confidence) => {
    const response = await api.post('/auth/prediction-history', { 
      sneakerId, sneakerName, predictedPrice, confidence 
    });
    return response.data;
  },

  // Get prediction history
  getPredictionHistory: async () => {
    const response = await api.get('/auth/prediction-history');
    return response.data;
  },
};

// Favorites API
export const favoritesAPI = {
  // Get all favorites
  getAll: async () => {
    const response = await api.get('/favorites');
    return response.data;
  },

  // Add to favorites
  add: async (sneakerData) => {
    const response = await api.post('/favorites', sneakerData);
    return response.data;
  },

  // Remove from favorites
  remove: async (id) => {
    const response = await api.delete(`/favorites/${id}`);
    return response.data;
  },

  // Check if sneaker is favorited
  check: async (sneakerId) => {
    const response = await api.get(`/favorites/check/${sneakerId}`);
    return response.data;
  },
};

// Sneaker API - ML Service Integration
export const sneakerAPI = {
  // Search sneakers
  search: async (name = '', brand = '') => {
    const response = await api.get('/sneakers/search', { params: { name, brand } });
    return response.data;
  },

  // Get price prediction
  predict: async (sneakerData) => {
    const response = await api.post('/sneakers/predict', sneakerData);
    return response.data;
  },

  // Get hype score for a sneaker
  getHypeScore: async (shoeName) => {
    const response = await api.post('/sneakers/hype', { shoe_name: shoeName });
    return response.data;
  },

  // Get all hype scores
  getAllHypeScores: async () => {
    const response = await api.get('/sneakers/hype-scores');
    return response.data;
  },

  // Get Google Trends data
  getTrends: async (keywords, timeframe = 'today 3-m') => {
    const response = await api.post('/sneakers/trends', { keywords, timeframe });
    return response.data;
  },

  // Get cached trends
  getCachedTrends: async () => {
    const response = await api.get('/sneakers/trends/cached');
    return response.data;
  },

  // Get price statistics
  getStats: async (brand = null) => {
    const response = await api.get('/sneakers/stats', { params: { brand } });
    return response.data;
  },

  // Get supported brands
  getBrands: async () => {
    const response = await api.get('/sneakers/brands');
    return response.data;
  },

  // Analyze comment sentiment
  analyzeComment: async (comment) => {
    const response = await api.post('/sneakers/analyze-comment', { comment });
    return response.data;
  },

  // Check ML service health
  checkHealth: async () => {
    const response = await api.get('/sneakers/ml-health');
    return response.data;
  },

  // Search eBay listings
  searchEbay: async (keyword, limit = 50) => {
    const response = await api.get('/sneakers/ebay/search', { params: { keyword, limit } });
    return response.data;
  },

  // Get eBay price data
  getEbayPrices: async (keyword) => {
    const response = await api.get('/sneakers/ebay/prices', { params: { keyword } });
    return response.data;
  },

  // Get combined market analysis (eBay + Google Trends)
  getMarketAnalysis: async (sneakerName, brand, retailPrice) => {
    const response = await api.post('/sneakers/market-analysis', {
      sneaker_name: sneakerName,
      brand,
      retail_price: retailPrice
    });
    return response.data;
  },

  // AI-powered smart natural language search
  smartSearch: async (query) => {
    const response = await api.post('/sneakers/smart-search', { query });
    return response.data;
  },

  // AI-powered sneaker recommendations
  getAIRecommendations: async (preferences) => {
    const response = await api.post('/sneakers/ai-recommend', preferences);
    return response.data;
  },

  // Get sneaker image URL
  getImageUrl: async (name, multiple = false) => {
    const response = await api.get('/sneakers/image-url', { params: { name, multiple } });
    return response.data;
  },

  // Get sneaker categories with images
  getCategories: async () => {
    const response = await api.get('/sneakers/categories');
    return response.data;
  },

  // Get enhanced sneakers with hype/trend scores
  getEnhanced: async (brand = null, limit = 50, sortBy = 'hype_score') => {
    const response = await api.get('/sneakers/enhanced', { 
      params: { brand, limit, sort_by: sortBy } 
    });
    return response.data;
  },

  // Get price history and forecast for a sneaker
  getPriceHistory: async (id = null, name = null) => {
    const response = await api.get('/sneakers/price-history', { params: { id, name } });
    return response.data;
  },

  /**
   * Get detailed price analytics for a sneaker
   * Returns statistics, technical indicators, trend analysis, charts data
   * @param {string} name - Sneaker name
   * @returns {Object} Comprehensive analytics data
   */
  getPriceAnalytics: async (name) => {
    const response = await api.get('/sneakers/price-analytics', { params: { name } });
    return response.data;
  },

  // Compare prices across multiple sneakers
  comparePrices: async (sneakers) => {
    const response = await api.post('/sneakers/price-comparison', { sneakers });
    return response.data;
  },

  // Get Prophet time-series forecast
  getProphetForecast: async (sneakerName, periods = 30) => {
    const response = await api.post('/sneakers/prophet-forecast', { 
      sneaker_name: sneakerName, 
      periods 
    });
    return response.data;
  },

  // ==================== LIVE DATA ENDPOINTS ====================

  // Get LIVE data from Google Trends + Reddit for a sneaker
  getLiveSneakerData: async (sneakerName) => {
    const response = await api.post('/sneakers/live/sneaker', { sneaker_name: sneakerName });
    return response.data;
  },

  // Get LIVE Google Trends interest data
  getLiveTrends: async (keyword, timeframe = 'now 7-d') => {
    const response = await api.post('/sneakers/live/trends', { keyword, timeframe });
    return response.data;
  },

  // Get LIVE Reddit discussions with sentiment
  getLiveReddit: async (sneakerName, limit = 30) => {
    const response = await api.post('/sneakers/live/reddit', { sneaker_name: sneakerName, limit });
    return response.data;
  },

  // Get current HOT Reddit discussions
  getRedditHot: async () => {
    const response = await api.get('/sneakers/live/reddit/hot');
    return response.data;
  },

  // Get what's trending RIGHT NOW
  getTrendingNow: async () => {
    const response = await api.get('/sneakers/live/trending');
    return response.data;
  },

  // Get LIVE hype score from real-time data
  getLiveHypeScore: async (sneakerName) => {
    const response = await api.post('/sneakers/live/hype-score', { sneaker_name: sneakerName });
    return response.data;
  },

  // ==================== 📱 SOCIAL MEDIA PREDICTION (Recommended) ====================

  /**
   * Get price prediction based on social media presence
   * Uses: Time Series Forecasting + Linear Regression + Reddit + Google Trends
   * 
   * Shows proper UP ↑ / DOWN ↓ percentage indicators
   * 
   * @param {Object} sneakerData - Sneaker details
   * @returns {Object} Prediction with trend_indicator (↑/↓), trend_label (UP/DOWN), trend_color
   */
  predictSocialPrice: async (sneakerData) => {
    const response = await api.post('/sneakers/predict-social', sneakerData);
    return response.data;
  },

  // ==================== 🔥 ENSEMBLE AI PREDICTION ====================

  /**
   * Get BEST PRICE prediction using ALL 7 AI models:
   * - Random Forest, Gradient Boosting, Ridge/Linear Regression
   * - Prophet Time Series
   * - Sentiment Analysis (Reddit)
   * - Google Trends
   * - Groq LLM Market Analysis
   * 
   * @param {Object} sneakerData - Sneaker details
   * @param {string} sneakerData.sneaker_name - Name of the sneaker
   * @param {string} sneakerData.brand - Brand (e.g., "Yeezy", "Nike", "Off-White")
   * @param {number} sneakerData.retail_price - Retail price
   * @param {string} [sneakerData.release_date] - Release date (YYYY-MM-DD)
   * @param {number} [sneakerData.shoe_size] - Shoe size (default: 10)
   * @param {string} [sneakerData.region] - Region (default: "California")
   * @param {boolean} [includeSentiment=true] - Include sentiment analysis
   * @param {boolean} [includeTrends=true] - Include Google Trends
   * @param {boolean} [includeGroq=true] - Include Groq LLM analysis
   * @returns {Object} Prediction result with best price, confidence, and recommendation
   */
  predictBestPrice: async (sneakerData, includeSentiment = true, includeTrends = true, includeGroq = true) => {
    const response = await api.post('/sneakers/predict-best-price', {
      ...sneakerData,
      include_sentiment: includeSentiment,
      include_trends: includeTrends,
      include_groq: includeGroq
    });
    return response.data;
  },

  /**
   * Get QUICK price prediction using only ML models (faster, no real-time data)
   * Good for batch operations or when speed is priority
   */
  predictBestPriceQuick: async (sneakerData) => {
    const response = await api.post('/sneakers/predict-best-price/quick', sneakerData);
    return response.data;
  },

  /**
   * Get BATCH price predictions for multiple sneakers
   * @param {Array} sneakers - Array of sneaker objects with sneaker_name, brand, retail_price
   * @returns {Object} Batch prediction results
   */
  predictBestPriceBatch: async (sneakers) => {
    const response = await api.post('/sneakers/predict-best-price/batch', { sneakers });
    return response.data;
  },

  /**
   * Get information about all AI models in the ensemble
   * Includes model types, weights, training metrics
   */
  getModelsInfo: async () => {
    const response = await api.get('/sneakers/models/info');
    return response.data;
  },
};

export default api;


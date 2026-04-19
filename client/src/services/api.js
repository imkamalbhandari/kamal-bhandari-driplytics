import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

  // Delete account permanently
  deleteAccount: async (currentPassword) => {
    try {
      const response = await api.post('/auth/profile/delete', { currentPassword });
      return response.data;
    } catch (error) {
      // Fallback for servers running older route shape.
      if (error.response?.status === 404 || error.response?.status === 405) {
        const response = await api.delete('/auth/profile', { data: { currentPassword } });
        return response.data;
      }
      throw error;
    }
  },

  // Upload profile picture
  uploadProfilePicture: async (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file);
    const response = await api.post('/auth/profile/picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Remove profile picture
  removeProfilePicture: async () => {
    const response = await api.delete('/auth/profile/picture');
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

  // Get BEST price prediction using ensemble AI models
  predictBestPrice: async (sneakerData) => {
    const response = await api.post('/sneakers/predict-best-price', sneakerData);
    return response.data;
  },

  // Get QUICK best price prediction (ML-only)
  predictBestPriceQuick: async (sneakerData) => {
    const response = await api.post('/sneakers/predict-best-price/quick', sneakerData);
    return response.data;
  },

  // Get BATCH best price predictions for multiple sneakers
  predictBestPriceBatch: async (sneakers) => {
    const payload = Array.isArray(sneakers) ? { sneakers } : sneakers;
    const response = await api.post('/sneakers/predict-best-price/batch', payload);
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
};

// Listings API - Trade/Marketplace
export const listingsAPI = {
  // Get all active listings (marketplace)
  getAll: async (filters = {}) => {
    const response = await api.get('/listings', { params: filters });
    return response.data;
  },

  // Get user's own listings
  getMyListings: async () => {
    const response = await api.get('/listings/my');
    return response.data;
  },

  // Get user's purchases
  getPurchases: async () => {
    const response = await api.get('/listings/purchases');
    return response.data;
  },

  // Get single listing
  getById: async (id) => {
    const response = await api.get(`/listings/${id}`);
    return response.data;
  },

  // Create new listing
  create: async (listingData) => {
    const response = await api.post('/listings', listingData);
    return response.data;
  },

  // Update listing
  update: async (id, listingData) => {
    const response = await api.put(`/listings/${id}`, listingData);
    return response.data;
  },

  // Delete/Cancel listing
  delete: async (id) => {
    const response = await api.delete(`/listings/${id}`);
    return response.data;
  },

  // Buy a listing
  buy: async (id) => {
    const response = await api.post(`/listings/${id}/buy`);
    return response.data;
  },

  // Get marketplace stats
  getStats: async () => {
    const response = await api.get('/listings/stats/overview');
    return response.data;
  },
};

// ========== Chat API ==========
export const chatAPI = {
  // Get all conversations
  getConversations: async () => {
    const response = await api.get('/chat/conversations');
    return response.data;
  },

  // Get messages for a conversation
  getMessages: async (conversationId, page = 1, limit = 50) => {
    const response = await api.get(`/chat/messages/${conversationId}`, {
      params: { page, limit }
    });
    return response.data;
  },

  // Send a message
  sendMessage: async (receiverId, content, listingId = null) => {
    const response = await api.post('/chat/messages', {
      receiverId,
      content,
      listingId
    });
    return response.data;
  },

  // Start or get a conversation
  startConversation: async (receiverId, listingId = null) => {
    const response = await api.post('/chat/start', {
      receiverId,
      listingId
    });
    return response.data;
  },

  // Mark messages as read
  markAsRead: async (conversationId) => {
    const response = await api.put(`/chat/read/${conversationId}`);
    return response.data;
  },

  // Get unread count
  getUnreadCount: async () => {
    const response = await api.get('/chat/unread');
    return response.data;
  },

  // Delete a conversation
  deleteConversation: async (conversationId) => {
    const response = await api.delete(`/chat/conversations/${conversationId}`);
    return response.data;
  }
};

// Admin API
export const adminAPI = {
  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  getUsers: async (search = '') => {
    const response = await api.get('/admin/users', { params: { search } });
    return response.data;
  },

  getUserListings: async (userId) => {
    const response = await api.get(`/admin/users/${userId}/listings`);
    return response.data;
  },

  toggleAdmin: async (userId) => {
    const response = await api.put(`/admin/users/${userId}/toggle-admin`);
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },

  getListings: async (status = 'all', search = '') => {
    const response = await api.get('/admin/listings', { params: { status, search } });
    return response.data;
  },

  updateListingStatus: async (listingId, status) => {
    const response = await api.put(`/admin/listings/${listingId}/status`, { status });
    return response.data;
  },

  deleteListing: async (listingId) => {
    const response = await api.delete(`/admin/listings/${listingId}`);
    return response.data;
  }
};

// ==================== Payments API (Khalti) ====================
export const paymentAPI = {
  getPlans: async () => {
    const response = await api.get('/payments/plans');
    return response.data;
  },

  getStatus: async () => {
    const response = await api.get('/payments/status');
    return response.data;
  },

  /** Check if user can make a prediction (free limit 5/month). Returns { canPredict, remaining, requiresSubscription }. */
  checkPrediction: async () => {
    const response = await api.post('/payments/check-prediction');
    return response.data;
  },

  /** Record a prediction usage (increments count). Returns { remaining }. */
  usePrediction: async () => {
    const response = await api.post('/payments/use-prediction');
    return response.data;
  },

  initiatePayment: async (planType) => {
    const response = await api.post('/payments/initiate', { planType });
    return response.data;
  },

  verifyPayment: async (paymentData) => {
    const response = await api.post('/payments/verify', paymentData);
    return response.data;
  },

  getHistory: async () => {
    const response = await api.get('/payments/history');
    return response.data;
  },
};

// ==================== Alerts API ====================
export const alertsAPI = {
  // Get all alerts for current user
  getAll: async () => {
    const response = await api.get('/alerts');
    return response.data;
  },

  // Create new alert
  create: async (alertData) => {
    const response = await api.post('/alerts', alertData);
    return response.data;
  },

  // Update alert
  update: async (id, alertData) => {
    const response = await api.put(`/alerts/${id}`, alertData);
    return response.data;
  },

  // Toggle alert enabled/disabled
  toggle: async (id) => {
    const response = await api.put(`/alerts/${id}/toggle`);
    return response.data;
  },

  // Delete alert
  delete: async (id) => {
    const response = await api.delete(`/alerts/${id}`);
    return response.data;
  },

  // Manually check alerts (get fresh predictions)
  check: async () => {
    const response = await api.post('/alerts/check');
    return response.data;
  },
};

export default api;


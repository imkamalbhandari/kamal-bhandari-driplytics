const express = require('express');
const router = express.Router();
const axios = require('axios');

// ML Service URL - runs on port 5002
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';
console.log('ML Service URL configured as:', ML_SERVICE_URL);

/**
 * Search sneakers
 * GET /api/sneakers/search?name=jordan&brand=Nike
 */
router.get('/search', async (req, res) => {
  try {
    const { name, brand } = req.query;
    
    const response = await axios.get(`${ML_SERVICE_URL}/sneakers/search`, {
      params: { name, brand }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Sneaker search error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search sneakers',
      message: error.message 
    });
  }
});

/**
 * Get price prediction for a sneaker
 * POST /api/sneakers/predict
 * Body: { brand, gender, retail_price, release_date, volatility }
 */
router.post('/predict', async (req, res) => {
  try {
    const { brand, gender, retail_price, release_date, volatility } = req.body;
    
    const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
      brand,
      gender,
      retail_price,
      release_date,
      volatility
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Prediction error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get prediction',
      message: error.message 
    });
  }
});

/**
 * Get hype score for a sneaker
 * POST /api/sneakers/hype
 * Body: { shoe_name }
 */
router.post('/hype', async (req, res) => {
  try {
    const { shoe_name } = req.body;
    
    const response = await axios.post(`${ML_SERVICE_URL}/hype-score`, {
      shoe_name
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Hype score error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get hype score',
      message: error.message 
    });
  }
});

/**
 * Get all hype scores
 * GET /api/sneakers/hype-scores
 */
router.get('/hype-scores', async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/hype-scores`);
    res.json(response.data);
  } catch (error) {
    console.error('Hype scores error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get hype scores',
      message: error.message 
    });
  }
});

/**
 * Get Google Trends data
 * POST /api/sneakers/trends
 * Body: { keywords: ["Air Jordan 1", "Yeezy"], timeframe: "today 3-m" }
 */
router.post('/trends', async (req, res) => {
  try {
    const { keywords, timeframe } = req.body;
    
    const response = await axios.post(`${ML_SERVICE_URL}/google-trends`, {
      keywords,
      timeframe: timeframe || 'today 3-m'
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Trends error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get trends',
      message: error.message 
    });
  }
});

/**
 * Get cached Google Trends data
 * GET /api/sneakers/trends/cached
 */
router.get('/trends/cached', async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/google-trends/cached`);
    res.json(response.data);
  } catch (error) {
    console.error('Cached trends error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get cached trends',
      message: error.message 
    });
  }
});

/**
 * Get price statistics
 * GET /api/sneakers/stats?brand=Nike
 */
router.get('/stats', async (req, res) => {
  try {
    const { brand } = req.query;
    
    const response = await axios.get(`${ML_SERVICE_URL}/sneakers/stats`, {
      params: { brand }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get stats',
      message: error.message 
    });
  }
});

/**
 * Get supported brands
 * GET /api/sneakers/brands
 */
router.get('/brands', async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/brands`);
    res.json(response.data);
  } catch (error) {
    console.error('Brands error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get brands',
      message: error.message 
    });
  }
});

/**
 * Analyze comment sentiment
 * POST /api/sneakers/analyze-comment
 * Body: { comment: "These are fire!" }
 */
router.post('/analyze-comment', async (req, res) => {
  try {
    const { comment } = req.body;
    
    const response = await axios.post(`${ML_SERVICE_URL}/analyze-comment`, {
      comment
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Comment analysis error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze comment',
      message: error.message 
    });
  }
});

/**
 * Health check for ML service
 * GET /api/sneakers/ml-health
 */
router.get('/ml-health', async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/health`);
    res.json(response.data);
  } catch (error) {
    res.status(503).json({ 
      success: false, 
      error: 'ML service is not available',
      message: 'Make sure ml_service is running on port 5002'
    });
  }
});

/**
 * Combined market analysis (Google Trends only - eBay removed)
 * POST /api/sneakers/market-analysis
 * Body: { sneaker_name, brand, retail_price }
 */
router.post('/market-analysis', async (req, res) => {
  try {
    const { sneaker_name, brand, retail_price } = req.body;
    
    const response = await axios.post(`${ML_SERVICE_URL}/market-analysis`, {
      sneaker_name,
      brand,
      retail_price
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Market analysis error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get market analysis',
      message: error.message 
    });
  }
});

/**
 * AI-powered smart natural language search
 * POST /api/sneakers/smart-search
 * Body: { query: "Show me Jordans under $200" }
 */
router.post('/smart-search', async (req, res) => {
  try {
    const { query } = req.body;
    
    const response = await axios.post(`${ML_SERVICE_URL}/smart-search`, {
      query
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Smart search error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to perform smart search',
      message: error.message 
    });
  }
});

/**
 * AI-powered sneaker recommendations
 * POST /api/sneakers/ai-recommend
 * Body: { favorites: [...], budget: "200-400", style: "streetwear" }
 */
router.post('/ai-recommend', async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/ai-recommend`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('AI recommendation error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get AI recommendations',
      message: error.message 
    });
  }
});

/**
 * Proxy sneaker images from ML service
 * GET /api/sneakers/images/:folder/:filename
 */
router.get('/images/:folder/:filename', async (req, res) => {
  try {
    const { folder, filename } = req.params;
    const response = await axios.get(`${ML_SERVICE_URL}/sneakers/images/${folder}/${filename}`, {
      responseType: 'stream'
    });
    
    res.setHeader('Content-Type', response.headers['content-type']);
    response.data.pipe(res);
  } catch (error) {
    console.error('Image proxy error:', error.message);
    res.status(404).json({ 
      success: false, 
      error: 'Image not found'
    });
  }
});

/**
 * Get image URL for a sneaker
 * GET /api/sneakers/image-url?name=Nike Air Jordan 1
 */
router.get('/image-url', async (req, res) => {
  try {
    const { name, multiple } = req.query;
    
    const response = await axios.get(`${ML_SERVICE_URL}/sneakers/image-url`, {
      params: { name, multiple }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Image URL error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get image URL',
      message: error.message 
    });
  }
});

/**
 * Get sneaker categories with sample images
 * GET /api/sneakers/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/sneakers/categories`);
    res.json(response.data);
  } catch (error) {
    console.error('Categories error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get categories',
      message: error.message 
    });
  }
});

/**
 * Get enhanced sneaker data with images
 * GET /api/sneakers/enhanced?brand=Nike&limit=20&sort_by=hype_score
 */
router.get('/enhanced', async (req, res) => {
  try {
    const { brand, limit, sort_by } = req.query;
    
    const response = await axios.get(`${ML_SERVICE_URL}/sneakers/enhanced`, {
      params: { brand, limit, sort_by }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Enhanced sneakers error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get enhanced sneakers',
      message: error.message 
    });
  }
});

/**
 * Get detailed price analytics for a sneaker
 * GET /api/sneakers/price-analytics?name=Air Jordan 1
 * 
 * Returns:
 * - Statistics (avg, median, std dev, range)
 * - Technical indicators (RSI, MACD, Bollinger Bands, Moving Averages)
 * - Trend analysis
 * - Volatility metrics
 * - ROI calculations
 * - Charts data (daily, weekly, monthly, by size)
 */
router.get('/price-analytics', async (req, res) => {
  try {
    const { name } = req.query;
    
    const response = await axios.get(`${ML_SERVICE_URL}/price-analytics`, {
      params: { name }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Price analytics error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get price analytics',
      message: error.message 
    });
  }
});

/**
 * Get price history and forecast for a sneaker
 * GET /api/sneakers/price-history?id=xxx or ?name=Air Jordan 1
 */
router.get('/price-history', async (req, res) => {
  try {
    const { id, name } = req.query;
    
    const response = await axios.get(`${ML_SERVICE_URL}/price-history`, {
      params: { id, name }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Price history error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get price history',
      message: error.message 
    });
  }
});

/**
 * Compare prices across multiple sneakers
 * POST /api/sneakers/price-comparison
 * Body: { sneakers: ["Air Jordan 1", "Yeezy 350"] }
 */
router.post('/price-comparison', async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/price-comparison`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Price comparison error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to compare prices',
      message: error.message 
    });
  }
});

/**
 * Prophet time-series forecast
 * POST /api/sneakers/prophet-forecast
 * Body: { sneaker_name: "Air Jordan 1", periods: 30 }
 */
router.post('/prophet-forecast', async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/prophet-forecast`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Prophet forecast error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get forecast',
      message: error.message 
    });
  }
});

// ==================== LIVE DATA ENDPOINTS ====================

/**
 * Get LIVE data from Google Trends + Reddit for a sneaker
 * POST /api/sneakers/live/sneaker
 * Body: { sneaker_name: "Air Jordan 1" }
 */
router.post('/live/sneaker', async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/live/sneaker`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Live sneaker data error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get live sneaker data',
      message: error.message 
    });
  }
});

/**
 * Get LIVE Google Trends interest data
 * POST /api/sneakers/live/trends
 * Body: { keyword: "Nike Dunk", timeframe: "now 7-d" }
 */
router.post('/live/trends', async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/live/trends`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Live trends error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get live trends',
      message: error.message 
    });
  }
});

/**
 * Get LIVE Reddit discussions with sentiment
 * POST /api/sneakers/live/reddit
 * Body: { sneaker_name: "Yeezy 350", limit: 30 }
 */
router.post('/live/reddit', async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/live/reddit`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Live Reddit error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get live Reddit data',
      message: error.message 
    });
  }
});

/**
 * Get current HOT Reddit discussions
 * GET /api/sneakers/live/reddit/hot
 */
router.get('/live/reddit/hot', async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/live/reddit/hot`);
    res.json(response.data);
  } catch (error) {
    console.error('Reddit hot error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get Reddit hot posts',
      message: error.message 
    });
  }
});

/**
 * Get what's trending RIGHT NOW
 * GET /api/sneakers/live/trending
 */
router.get('/live/trending', async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/live/trending`);
    res.json(response.data);
  } catch (error) {
    console.error('Trending error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get trending data',
      message: error.message 
    });
  }
});

/**
 * Get LIVE hype score from real-time data
 * POST /api/sneakers/live/hype-score
 * Body: { sneaker_name: "Air Jordan 4" }
 */
router.post('/live/hype-score', async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/live/hype-score`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Live hype score error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get live hype score',
      message: error.message 
    });
  }
});

// =============================================================================
// 📱 SOCIAL MEDIA-BASED PREDICTION - Time Series + Linear + Social
// =============================================================================

/**
 * Get price prediction based on social media presence
 * Uses: Time Series Forecasting + Linear Regression + Social Media (Reddit + Google Trends)
 * POST /api/sneakers/predict-social
 * Body: { sneaker_name, brand, retail_price, release_date, shoe_size, region }
 */
router.post('/predict-social', async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict-social`, req.body, {
      timeout: 30000 // 30 second timeout
    });
    res.json(response.data);
  } catch (error) {
    console.error('Social prediction error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get social media-based prediction',
      message: error.message 
    });
  }
});

// =============================================================================
// 🔥 ENSEMBLE AI PREDICTION - Best Price using ALL Models
// =============================================================================

/**
 * Get BEST price prediction using ALL 7 AI models
 * POST /api/sneakers/predict-best-price
 * Body: {
 *   sneaker_name: "Adidas Yeezy Boost 350 V2 Beluga",
 *   brand: "Yeezy",
 *   retail_price: 220,
 *   release_date: "2023-01-15",
 *   shoe_size: 10,
 *   region: "California",
 *   include_sentiment: true,
 *   include_trends: true,
 *   include_groq: true
 * }
 * 
 * Models Used:
 * 1. Random Forest Regressor
 * 2. Gradient Boosting Regressor
 * 3. Ridge/Linear Regression
 * 4. Prophet Time Series
 * 5. Sentiment Analysis (Reddit)
 * 6. Google Trends
 * 7. Groq LLM Market Analysis
 */
router.post('/predict-best-price', async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict-best-price`, req.body, {
      timeout: 30000 // 30 second timeout for comprehensive prediction
    });
    res.json(response.data);
  } catch (error) {
    console.error('Best price prediction error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get best price prediction',
      message: error.message 
    });
  }
});

/**
 * Get QUICK price prediction using only ML models (faster)
 * POST /api/sneakers/predict-best-price/quick
 * Body: { sneaker_name, brand, retail_price, release_date, shoe_size, region }
 */
router.post('/predict-best-price/quick', async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict-best-price/quick`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Quick prediction error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get quick prediction',
      message: error.message 
    });
  }
});

/**
 * Get BATCH price predictions for multiple sneakers
 * POST /api/sneakers/predict-best-price/batch
 * Body: {
 *   sneakers: [
 *     { sneaker_name: "...", brand: "...", retail_price: ... },
 *     { sneaker_name: "...", brand: "...", retail_price: ... }
 *   ]
 * }
 */
router.post('/predict-best-price/batch', async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict-best-price/batch`, req.body, {
      timeout: 60000 // 60 second timeout for batch
    });
    res.json(response.data);
  } catch (error) {
    console.error('Batch prediction error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get batch predictions',
      message: error.message 
    });
  }
});

/**
 * Get information about all AI models in the ensemble
 * GET /api/sneakers/models/info
 */
router.get('/models/info', async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/models/info`);
    res.json(response.data);
  } catch (error) {
    console.error('Models info error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get models info',
      message: error.message 
    });
  }
});

module.exports = router;

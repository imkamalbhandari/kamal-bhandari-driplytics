import { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { sneakerAPI, favoritesAPI, authAPI, paymentAPI } from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function SneakerDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedSize, setSelectedSize] = useState('10');
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [prediction, setPrediction] = useState(null);
  const [hypeScore, setHypeScore] = useState(null);
  const [, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState(null);
  const [, setForecast] = useState([]);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [predictionStatus, setPredictionStatus] = useState(null); // { remaining, unlimited } from getStatus
  const [subscriptionRequired, setSubscriptionRequired] = useState(false); // whether paywall modal is shown
  const [, setLiveData] = useState(null);
  const [liveDataLoading] = useState(false);

  // Fetch prediction status on mount
  useEffect(() => {
    const fetchPredictionStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await paymentAPI.getStatus();
        if (res.success) setPredictionStatus(res);
      } catch { /* not logged in or server down */ }
    };
    fetchPredictionStatus();
  }, []);

  // Get sneaker data from location state
  const sneakerFromState = location.state?.sneaker;
  
  const defaultSneaker = {
    id: id,
    name: 'Loading...',
    brand: 'Loading',
    colorway: '',
    styleCode: '',
    releaseDate: '',
    retailPrice: 0,
    image: null,
    description: 'Loading sneaker details...',
    sizes: ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13'],
    priceBySize: {
      '7': 0, '7.5': 0, '8': 0, '8.5': 0, '9': 0, '9.5': 0,
      '10': 0, '10.5': 0, '11': 0, '11.5': 0, '12': 0, '13': 0
    },
    volatility: 0.15,
    gender: 'men',
  };

  const [sneaker, setSneaker] = useState(sneakerFromState || defaultSneaker);

  // Fetch sneaker data if not passed via state
  useEffect(() => {
    const fetchSneakerData = async () => {
      if (!sneakerFromState && id) {
        try {
          // Search for the sneaker by name/id
          const response = await sneakerAPI.search(decodeURIComponent(id));
          if (response.success && response.data?.length > 0) {
            const sneakerData = response.data[0];
            const retailPrice = sneakerData.RetailPrice || 150;
            const basePrice = retailPrice * (1 + (sneakerData.ChangePercent || 0.1));
            
            setSneaker({
              id: sneakerData.Name,
              name: sneakerData.Name || 'Unknown Sneaker',
              brand: sneakerData.Brand || 'Unknown',
              colorway: sneakerData.Colorway || '',
              styleCode: sneakerData.StyleID || '',
              releaseDate: sneakerData.ReleaseDate || '',
              retailPrice: retailPrice,
              image: sneakerData.Image || sneakerData.image_url || null,
              description: `${sneakerData.Name} - A premium sneaker from ${sneakerData.Brand}.`,
              sizes: ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13'],
              priceBySize: {
                '7': Math.round(basePrice * 1.05),
                '7.5': Math.round(basePrice * 1.03),
                '8': Math.round(basePrice * 1.02),
                '8.5': Math.round(basePrice * 1.01),
                '9': Math.round(basePrice),
                '9.5': Math.round(basePrice * 0.99),
                '10': Math.round(basePrice),
                '10.5': Math.round(basePrice * 1.01),
                '11': Math.round(basePrice * 1.02),
                '11.5': Math.round(basePrice * 1.01),
                '12': Math.round(basePrice * 0.98),
                '13': Math.round(basePrice * 0.95)
              },
              volatility: sneakerData.Volatility || 0.15,
              gender: sneakerData.Gender || 'men',
            });
          }
        } catch (err) {
          console.error('Error fetching sneaker data:', err);
        }
      }
    };

    fetchSneakerData();
  }, [id, sneakerFromState]);

  // Check if sneaker is favorited
  useEffect(() => {
    const checkFavorite = async () => {
      if (sneaker.id) {
        try {
          const response = await favoritesAPI.check(sneaker.id);
          if (response.success) {
            setIsFavorite(response.isFavorite);
            setFavoriteId(response.favoriteId);
          }
        } catch (err) {
          console.error('Error checking favorite:', err);
        }
      }
    };
    checkFavorite();
  }, [sneaker.id]);

  // Handle favorite toggle
  const handleFavoriteToggle = async () => {
    try {
      if (isFavorite && favoriteId) {
        await favoritesAPI.remove(favoriteId);
        setIsFavorite(false);
        setFavoriteId(null);
      } else {
        const response = await favoritesAPI.add({
          sneakerId: sneaker.id || sneaker.name,
          name: sneaker.name,
          brand: sneaker.brand,
          colorway: sneaker.colorway,
          styleCode: sneaker.styleCode,
          retailPrice: sneaker.retailPrice,
          releaseDate: sneaker.releaseDate,
          savedPrice: sneaker.priceBySize?.[selectedSize] || sneaker.retailPrice,
          gender: sneaker.gender,
          volatility: sneaker.volatility,
          image: sneaker.image || null
        });
        if (response.success) {
          setIsFavorite(true);
          setFavoriteId(response.data._id);
        }
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Handle Predict Price button click - Uses Social Media + Time Series + Linear Regression
  const handlePredictPrice = async () => {
    setSubscriptionRequired(false);
    setPredictionLoading(true);
    setShowPrediction(true);

    try {
      // Check if user can make a prediction
      const check = await paymentAPI.checkPrediction();
      if (!check.canPredict) {
        setSubscriptionRequired(true);
        setPredictionLoading(false);
        setShowPrediction(false);
        return;
      }

      // Record the prediction usage BEFORE making the call
      try {
        await paymentAPI.usePrediction();
      } catch (usageErr) {
        if (usageErr.response?.status === 403) {
          setSubscriptionRequired(true);
          setPredictionLoading(false);
          setShowPrediction(false);
          return;
        }
      }

      // 📱 Use Social Media-Based Prediction (Time Series + Linear Regression + Social)
      const socialResponse = await sneakerAPI.predictSocialPrice({
        sneaker_name: sneaker.name,
        brand: sneaker.brand,
        retail_price: sneaker.retailPrice,
        release_date: sneaker.releaseDate,
        shoe_size: parseFloat(selectedSize),
        region: 'California'
      });
      
      // Update remaining predictions count
      try {
        const statusRes = await paymentAPI.getStatus();
        if (statusRes.success) setPredictionStatus(statusRes);
      } catch {
        // Could not update prediction status
      }

      if (socialResponse.success) {
        const pred = socialResponse.prediction;
        const rec = socialResponse.recommendation;
        const models = socialResponse.models;
        const social = socialResponse.social_media;
        const input = socialResponse.input;
        
        setPrediction({
          // Main prediction - FUTURE predicted price
          price: pred.predicted_price,
          priceRange: pred.price_range,
          
          // Current market price from StockX (real data)
          currentPrice: pred.current_price || pred.stockx_data?.current_price || sneaker.retailPrice,
          retailPrice: pred.retail_price || sneaker.retailPrice,
          hasRealData: input?.has_real_data || false,
          stockxData: pred.stockx_data,
          
          // Price change with UP/DOWN indicators (future vs current)
          priceChange: pred.price_change,
          priceChangePercent: pred.price_change_percent,
          isIncrease: pred.is_increase,
          trendIndicator: pred.trend_indicator,  // ↑ or ↓
          trendLabel: pred.trend_label,          // UP or DOWN
          trendColor: pred.trend_color,          // green or red
          
          // Formatted display
          trend: pred.is_increase ? 'up' : 'down',
          changePercent: `${pred.trend_indicator} ${Math.abs(pred.price_change_percent).toFixed(1)}%`,
          
          // Confidence
          confidence: Math.round(pred.confidence * 100),
          timeframe: '30 days',
          
          // Social impact
          socialImpact: pred.social_impact,
          
          // Recommendation
          recommendation: `${rec.emoji} ${rec.action} - ${rec.description}`,
          recommendationAction: rec.action,
          
          // Price premium over retail
          pricePremium: pred.price_change,
          premiumOverRetail: pred.stockx_data ? pred.stockx_data.price_change : null,
          
          // Time Series forecast (no model name exposed)
          timeSeries: models.time_series ? {
            price7d: models.time_series.price_7d,
            price14d: models.time_series.price_14d,
            price30d: models.time_series.price_30d,
            lowerBound: models.time_series.lower_bound,
            upperBound: models.time_series.upper_bound,
            dataPoints: models.time_series.historical_data_points,
            confidence: models.time_series.confidence
          } : null,
          
          // Linear Regression (no model name exposed)
          linearRegression: models.linear_regression ? {
            predictedPrice: models.linear_regression.predicted_price,
            confidence: models.linear_regression.confidence
          } : null,
          
          // User-friendly factors from AI
          factorsConsidered: pred.factors_considered || [],
          
          // Forecast data (user-friendly)
          forecast: pred.forecast || null,
          
          // Social Media Data
          socialMedia: {
            combinedScore: social.combined_score,
            adjustmentPercent: social.price_adjustment_percent,
            reddit: social.reddit,
            googleTrends: social.google_trends
          },
          
          // Metadata
          processingTime: socialResponse.metadata?.processing_time
        });
        
        // Store forecast for chart
        if (models.time_series?.price_7d) {
          setForecast([
            { day: '7 days', price: models.time_series.price_7d },
            { day: '14 days', price: models.time_series.price_14d },
            { day: '30 days', price: models.time_series.price_30d }
          ]);
        }
        
        // Update hype score from Reddit with REAL data
        if (social.reddit) {
          setHypeScore({
            hype_score: social.reddit.hype_score || 50,
            engagement_level: social.reddit.posts_found > 30 ? 'viral' :
                             social.reddit.posts_found > 15 ? 'high' : 
                             social.reddit.posts_found > 5 ? 'moderate' : 'low',
            sentiment_score: social.reddit.avg_sentiment,
            sentiment_label: social.reddit.sentiment_label,
            posts_found: social.reddit.posts_found,
            total_upvotes: social.reddit.total_upvotes || 0,
            total_comments: social.reddit.total_comments || 0,
            top_posts: social.reddit.top_posts || [],
            source: 'reddit_live'
          });
        }
        
        // Update live data with Google Trends
        if (social.google_trends) {
          setLiveData({
            google_trends: {
              current_interest: social.google_trends.current_interest,
              avg_interest: social.google_trends.avg_interest,
              trend_direction: social.google_trends.trend_direction
            }
          });
        }
      }

      // Track prediction
      try {
        await authAPI.addPredictionHistory(
          sneaker.id,
          sneaker.name,
          socialResponse.prediction?.predicted_price || sneaker.retailPrice,
          Math.round(socialResponse.prediction?.confidence * 100) || 70
        );
      } catch {
        // Silently fail
      }

    } catch (err) {
      console.error('Prediction error:', err);
      if (err.response?.status === 403 && err.response?.data?.requiresSubscription) {
        setSubscriptionRequired(true);
      } else {
        setPrediction({
          price: Math.round(sneaker.retailPrice * 1.1),
          confidence: 70,
          trend: 'up',
          trendIndicator: '↑',
          trendLabel: 'UP',
          trendColor: 'green',
          changePercent: '↑ 10%',
          isIncrease: true,
          timeframe: '30 days',
          recommendation: 'Hold - Analysis unavailable'
        });
      }
    } finally {
      setPredictionLoading(false);
    }
  };

  // Fetch price history on load (not predictions - those are on button click)
  useEffect(() => {
    const fetchPriceHistory = async () => {
      if (!sneaker.name || sneaker.name === 'Loading...') return;
      
      try {
        const response = await sneakerAPI.getPriceHistory(null, sneaker.name);
        
        if (response.success) {
          setPriceHistory(response.history);
          setForecast(response.forecast || []);
        }
      } catch (err) {
        console.error('Price history error:', err);
      }
      setLoading(false);
    };

    fetchPriceHistory();
  }, [sneaker.name]);

  // Get chart data from real price history or fallback to sample
  const getChartData = () => {
    if (priceHistory && priceHistory.dates && priceHistory.prices) {
      const dates = priceHistory.dates;
      const prices = priceHistory.prices;
      
      // Filter based on timeRange
      let filteredDates, filteredPrices;
      
      switch (timeRange) {
        case '7d':
          filteredDates = dates.slice(-7);
          filteredPrices = prices.slice(-7);
          break;
        case '30d':
          filteredDates = dates.slice(-30).filter((_, i) => i % 4 === 0);
          filteredPrices = prices.slice(-30).filter((_, i) => i % 4 === 0);
          break;
        case '90d':
          filteredDates = dates.slice(-90).filter((_, i) => i % 10 === 0);
          filteredPrices = prices.slice(-90).filter((_, i) => i % 10 === 0);
          break;
        case '1y':
        default:
          filteredDates = dates.filter((_, i) => i % 30 === 0);
          filteredPrices = prices.filter((_, i) => i % 30 === 0);
          break;
      }
      
      return {
        labels: filteredDates.map(d => {
          const date = new Date(d);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        data: filteredPrices.map(p => Math.round(p))
      };
    }
    
    // Fallback sample data
    const sampleData = {
      '7d': {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        data: [375, 380, 378, 382, 385, 388, 385],
      },
      '30d': {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        data: [365, 372, 378, 385],
      },
      '90d': {
        labels: ['Month 1', 'Month 2', 'Month 3'],
        data: [340, 358, 385],
      },
      '1y': {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        data: [320, 345, 365, 385],
      },
    };
    return sampleData[timeRange];
  };

  const priceChartData = getChartData();

  const chartData = {
    labels: priceChartData.labels,
    datasets: [
      {
        label: 'Price',
        data: priceChartData.data,
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(99, 102, 241)',
        pointBorderColor: '#fff',
        pointRadius: 6,
        pointHoverRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        borderColor: 'rgba(99, 102, 241, 0.5)',
        borderWidth: 1,
        callbacks: {
          label: (context) => `$${context.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)',
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)',
          callback: (value) => `$${value}`,
        },
      },
    },
  };

  const selectedSizePrice = Number(sneaker.priceBySize?.[selectedSize]);
  const currentPrice = Number.isFinite(selectedSizePrice) && selectedSizePrice > 0
    ? selectedSizePrice
    : (Number(sneaker.retailPrice) || 0);
  const retailPrice = Number(sneaker.retailPrice);
  const hasValidRetailPrice = Number.isFinite(retailPrice) && retailPrice > 0;
  const pricePremiumPercent = hasValidRetailPrice && currentPrice > 0
    ? ((currentPrice - retailPrice) / retailPrice) * 100
    : null;
  const monthlyPriceChangePercent = (() => {
    if (!priceHistory?.prices?.length) return null;

    const validPrices = priceHistory.prices
      .map(Number)
      .filter((price) => Number.isFinite(price) && price > 0);

    if (validPrices.length < 2) return null;

    const monthWindow = validPrices.slice(-30);
    if (monthWindow.length < 2) return null;

    const startPrice = monthWindow[0];
    const endPrice = monthWindow[monthWindow.length - 1];
    if (startPrice <= 0) return null;

    return ((endPrice - startPrice) / startPrice) * 100;
  })();

  const marketStats = [
    { label: 'Lowest Ask', value: `$${Math.round(currentPrice * 0.96)}`, platform: 'StockX' },
    { label: 'Highest Bid', value: `$${Math.round(currentPrice * 0.92)}`, platform: 'StockX' },
    { label: 'Last Sale', value: `$${currentPrice}`, platform: 'StockX' },
    { label: 'eBay Price', value: `$${Math.round(currentPrice * 1.03)}`, platform: 'eBay' },
  ];

  return (
    <Layout requireAuth>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link to="/search" className="hover:text-white transition-colors">Search</Link>
          <span>/</span>
          <span className="text-white">{sneaker.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left: Image */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
            <div className="aspect-square bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center overflow-hidden">
              {sneaker.image ? (
                <img 
                  src={sneaker.image} 
                  alt={sneaker.name}
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <div className="w-48 h-48 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-24 h-24 text-indigo-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-sm font-medium rounded-lg">
                {sneaker.brand}
              </span>
              {monthlyPriceChangePercent !== null && (
                <span className={`px-3 py-1 text-sm font-medium rounded-lg ${
                  monthlyPriceChangePercent >= 0
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {monthlyPriceChangePercent >= 0 ? '+' : ''}
                  {monthlyPriceChangePercent.toFixed(1)}% this month
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-white mb-2">{sneaker.name}</h1>
            <p className="text-gray-400 mb-6">{sneaker.colorway}</p>

            {/* Current Price */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Current Resale Price (Size {selectedSize})</p>
                  <p className="text-4xl font-bold text-white">${Math.round(currentPrice)}</p>
                </div>
                <button
                  onClick={handleFavoriteToggle}
                  className={`p-3 rounded-xl transition-all ${
                    isFavorite 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-white/5 text-gray-400 hover:text-red-400'
                  }`}
                >
                  <svg className="w-6 h-6" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>

              {/* Size Selector */}
              <div>
                <p className="text-gray-400 text-sm mb-3">Select Size (US)</p>
                <div className="grid grid-cols-6 gap-2">
                  {sneaker.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedSize === size
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* PREDICT PRICE BUTTON */}
              <button
                onClick={handlePredictPrice}
                disabled={predictionLoading}
                className="w-full mt-4 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {predictionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    Analyzing Social Media & Trends...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Predict Price (Social + AI)
                  </>
                )}
              </button>

              {/* Remaining predictions counter */}
              {predictionStatus && !predictionStatus.predictions?.unlimited && (
                <div className="mt-2 flex items-center justify-center gap-2">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i < (predictionStatus.predictions?.remaining || 0)
                            ? 'bg-indigo-400'
                            : 'bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-gray-400 text-xs">
                    {predictionStatus.predictions?.remaining || 0} of 5 free predictions left
                  </span>
                </div>
              )}
              {predictionStatus?.predictions?.unlimited && (
                <p className="mt-2 text-center text-xs text-emerald-400">
                  ✦ Unlimited predictions ({predictionStatus.subscription?.type?.toUpperCase()} plan)
                </p>
              )}

              {/* Subscription Paywall Modal */}
              {subscriptionRequired && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSubscriptionRequired(false)}>
                  <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                    {/* Lock icon */}
                    <div className="flex justify-center mb-5">
                      <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white text-center mb-2">Free Limit Reached</h3>
                    <p className="text-gray-400 text-center mb-6">
                      You've used all <span className="text-white font-semibold">5 free predictions</span> this month.
                      Upgrade to get unlimited AI-powered price predictions.
                    </p>

                    {/* Usage bar */}
                    <div className="mb-6">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Predictions used</span>
                        <span className="text-amber-400">5 / 5</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="w-full h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full" />
                      </div>
                    </div>

                    {/* Plans quick comparison */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
                        <div>
                          <p className="text-white font-semibold text-sm">Premium</p>
                          <p className="text-gray-400 text-xs">Unlimited predictions, 30 days</p>
                        </div>
                        <span className="text-violet-300 font-bold">रू 299</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
                        <div>
                          <p className="text-white font-semibold text-sm">Pro</p>
                          <p className="text-gray-400 text-xs">Unlimited + API access, 90 days</p>
                        </div>
                        <span className="text-purple-300 font-bold">रू 799</span>
                      </div>
                    </div>

                    {/* CTA buttons */}
                    <div className="flex flex-col gap-2">
                      <Link
                        to="/subscription"
                        className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-xl text-center transition-all"
                      >
                        Subscribe Now
                      </Link>
                      <button
                        onClick={() => setSubscriptionRequired(false)}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 font-medium rounded-xl transition-all"
                      >
                        Maybe Later
                      </button>
                    </div>

                    <p className="text-center text-gray-600 text-xs mt-4">
                      Resets monthly · Pay securely with Khalti
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Retail Price</p>
                <p className="text-white font-semibold">${sneaker.retailPrice}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Release Date</p>
                <p className="text-white font-semibold">{sneaker.releaseDate}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Style Code</p>
                <p className="text-white font-semibold">{sneaker.styleCode}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Price Premium</p>
                <p className={`font-semibold ${
                  pricePremiumPercent === null
                    ? 'text-gray-400'
                    : (pricePremiumPercent >= 0 ? 'text-green-400' : 'text-red-400')
                }`}>
                  {pricePremiumPercent === null
                    ? 'N/A'
                    : `${pricePremiumPercent >= 0 ? '+' : ''}${Math.round(pricePremiumPercent)}%`}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 className="text-white font-semibold mb-3">Description</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{sneaker.description}</p>
            </div>
          </div>
        </div>

        {/* Price History Chart */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Price History</h2>
            <div className="flex gap-2">
              {['7d', '30d', '90d', '1y'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    timeRange === range
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* AI Prediction Results - Clean Card Layout */}
        {showPrediction && (
          <div className="space-y-6">
            {/* Main Prediction Hero Card */}
            <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-sm rounded-2xl border border-indigo-500/30 p-8">
              {predictionLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
                  <p className="text-gray-400">Analyzing market data & social trends...</p>
                </div>
              ) : prediction ? (
                <>
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-indigo-500/30 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">AI Price Prediction</h2>
                      <p className="text-gray-400 text-sm">Next {prediction?.timeframe || '30 days'}</p>
                    </div>
                  </div>

                  {/* Price Comparison - Large Display */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Current Price */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 text-center">
                      <p className="text-gray-400 text-sm mb-2">Current Market Price</p>
                      <p className="text-4xl font-bold text-white mb-1">
                        ${Math.round(prediction.currentPrice || prediction.stockxData?.current_price || sneaker.retailPrice)}
                      </p>
                      {prediction.hasRealData && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                          Live from StockX
                        </span>
                      )}
                    </div>

                    {/* Expected Change */}
                    {prediction.pricePremium !== undefined && (
                      <div className={`rounded-2xl p-6 border text-center ${
                        prediction.pricePremium >= 0 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : 'bg-red-500/10 border-red-500/30'
                      }`}>
                        <p className="text-gray-400 text-sm mb-2">Expected Change</p>
                        <p className={`text-4xl font-bold mb-1 ${
                          prediction.pricePremium >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {prediction.pricePremium >= 0 ? '+' : '-'}${Math.abs(Math.round(prediction.pricePremium))}
                        </p>
                        <span className={`text-sm ${
                          prediction.pricePremium >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {prediction.isIncrease ? '↑' : '↓'} {Math.abs(prediction.priceChangePercent || 0).toFixed(1)}%
                        </span>
                      </div>
                    )}

                    {/* Predicted Price */}
                    <div className={`rounded-2xl p-6 border text-center ${
                      prediction.isIncrease || prediction.trend === 'up'
                        ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30'
                        : 'bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/30'
                    }`}>
                      <p className="text-gray-400 text-sm mb-2">Predicted in 30 Days</p>
                      <p className="text-4xl font-bold text-white mb-1">${Math.round(prediction.price)}</p>
                      <span className={`inline-flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full ${
                        prediction.isIncrease || prediction.trend === 'up' 
                          ? 'text-green-400 bg-green-500/20' 
                          : 'text-red-400 bg-red-500/20'
                      }`}>
                        {prediction.isIncrease ? '↑ UP' : '↓ DOWN'}
                      </span>
                    </div>
                  </div>

                  {/* Confidence & Recommendation Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Confidence */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-400 text-sm">Confidence Level</span>
                        <span className="text-white font-bold">{prediction.confidence}%</span>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                          style={{ width: `${prediction.confidence}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Recommendation */}
                    {prediction.recommendation && (
                      <div className={`rounded-xl p-4 border ${
                        prediction.recommendation.includes('Buy') ? 'bg-green-500/10 border-green-500/30' :
                        prediction.recommendation.includes('Sell') || prediction.recommendation.includes('Avoid') ? 'bg-red-500/10 border-red-500/30' :
                        'bg-yellow-500/10 border-yellow-500/30'
                      }`}>
                        <p className="text-sm font-medium text-white">{prediction.recommendation}</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  Click "Predict Price" above to get AI prediction
                </div>
              )}
            </div>

            {/* Two Column Layout for Forecast & Social */}
            {prediction && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Forecast & Market Data */}
                <div className="space-y-6">
                  {/* Price Forecast Card */}
                  {prediction.timeSeries && prediction.timeSeries.price7d && (
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="text-white font-semibold">Price Forecast</h3>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-xl p-4 text-center border border-purple-500/20">
                          <p className="text-gray-500 text-xs mb-1">7 Days</p>
                          <p className="text-white font-bold text-xl">${Math.round(prediction.timeSeries.price7d)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-xl p-4 text-center border border-purple-500/20">
                          <p className="text-gray-500 text-xs mb-1">14 Days</p>
                          <p className="text-white font-bold text-xl">${Math.round(prediction.timeSeries.price14d)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-xl p-4 text-center border border-purple-500/20">
                          <p className="text-gray-500 text-xs mb-1">30 Days</p>
                          <p className="text-white font-bold text-xl">${Math.round(prediction.timeSeries.price30d)}</p>
                        </div>
                      </div>

                      {prediction.timeSeries.lowerBound && prediction.timeSeries.upperBound && (
                        <div className="mt-4 bg-white/5 rounded-xl p-3 text-center">
                          <p className="text-gray-500 text-xs mb-1">30-Day Price Range</p>
                          <p className="text-white font-medium">
                            ${Math.round(prediction.timeSeries.lowerBound)} — ${Math.round(prediction.timeSeries.upperBound)}
                          </p>
                        </div>
                      )}

                      {prediction.timeSeries.dataPoints > 0 && (
                        <p className="text-gray-500 text-xs mt-3 text-center">
                          Based on {prediction.timeSeries.dataPoints} historical data points
                        </p>
                      )}
                    </div>
                  )}

                  {/* Market Stats Card */}
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                    <h3 className="text-white font-semibold mb-4">Market Data (Size {selectedSize})</h3>
                    <div className="space-y-3">
                      {marketStats.map((stat, index) => (
                        <div key={index} className="flex items-center justify-between py-3 px-4 bg-white/5 rounded-xl">
                          <div>
                            <p className="text-white font-medium">{stat.label}</p>
                            <p className="text-gray-500 text-xs">{stat.platform}</p>
                          </div>
                          <p className="text-white font-bold text-lg">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column - Social Hype */}
                <div className="space-y-6">
                  {/* Reddit Hype Score Card */}
                  {hypeScore && (
                    <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 backdrop-blur-sm rounded-2xl border border-orange-500/30 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-500/30 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-white font-semibold flex items-center gap-2">
                              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                              LIVE Reddit Hype
                            </h3>
                            <p className="text-gray-400 text-xs">Real-time data from Reddit</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-white">{Math.round(hypeScore.hype_score)}</div>
                          <div className="text-xs text-gray-500">/ 100</div>
                        </div>
                      </div>
                      
                      {/* Hype Bar */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 bg-white/10 rounded-full h-3 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all"
                            style={{ width: `${hypeScore.hype_score}%` }}
                          ></div>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-lg whitespace-nowrap ${
                          hypeScore.engagement_level === 'viral' ? 'bg-red-500/30 text-red-300' :
                          hypeScore.engagement_level === 'high' ? 'bg-orange-500/30 text-orange-300' :
                          hypeScore.engagement_level === 'moderate' ? 'bg-yellow-500/30 text-yellow-300' :
                          'bg-gray-500/30 text-gray-300'
                        }`}>
                          {hypeScore.engagement_level === 'viral' ? '🔥 VIRAL' :
                           hypeScore.engagement_level === 'high' ? '📈 HIGH' :
                           hypeScore.engagement_level === 'moderate' ? '📊 MODERATE' : '📉 LOW'}
                        </span>
                      </div>
                      
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                          <p className="text-xl font-bold text-white">{hypeScore.posts_found || 0}</p>
                          <p className="text-gray-500 text-xs">Posts</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                          <p className="text-xl font-bold text-orange-400">{hypeScore.total_upvotes || 0}</p>
                          <p className="text-gray-500 text-xs">Upvotes</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                          <p className="text-xl font-bold text-blue-400">{hypeScore.total_comments || 0}</p>
                          <p className="text-gray-500 text-xs">Comments</p>
                        </div>
                      </div>
                      
                      {/* Sentiment */}
                      <div className={`px-4 py-2 rounded-xl text-center font-medium ${
                        hypeScore.sentiment_label === 'Positive' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : hypeScore.sentiment_label === 'Negative'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}>
                        {hypeScore.sentiment_label === 'Positive' ? '😊 Community is Positive!' : 
                         hypeScore.sentiment_label === 'Negative' ? '😞 Community is Negative' : 
                         '😐 Community is Neutral'}
                      </div>
                      
                      {/* Top Posts */}
                      {hypeScore.top_posts && hypeScore.top_posts.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <p className="text-gray-400 text-xs mb-2">Top Reddit Discussions</p>
                          <div className="space-y-2">
                            {hypeScore.top_posts.slice(0, 2).map((post, idx) => (
                              <a 
                                key={idx}
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors"
                              >
                                <p className="text-white text-sm line-clamp-1">{post.title}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  <span className="text-orange-400 font-medium">↑{post.score}</span>
                                  <span className="text-blue-400">💬 {post.comments}</span>
                                  <span>r/{post.subreddit}</span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {liveDataLoading && !hypeScore && (
                    <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 backdrop-blur-sm rounded-2xl border border-orange-500/30 p-6">
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mb-3"></div>
                        <p className="text-gray-400 text-sm">Fetching live social data...</p>
                      </div>
                    </div>
                  )}

                  {/* Social Media Impact Card */}
                  {prediction.socialMedia && (
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                      <h3 className="text-white font-semibold mb-4">Social Media Impact</h3>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gradient-to-r from-orange-500/10 to-pink-500/10 rounded-xl p-4 border border-orange-500/20 text-center">
                          <p className="text-gray-500 text-xs mb-1">Social Score</p>
                          <p className="text-orange-400 font-bold text-2xl">{Math.round(prediction.socialMedia.combinedScore)}<span className="text-sm text-gray-500">/100</span></p>
                        </div>
                        <div className={`rounded-xl p-4 border text-center ${
                          prediction.socialMedia.adjustmentPercent >= 0 
                            ? 'bg-green-500/10 border-green-500/20' 
                            : 'bg-red-500/10 border-red-500/20'
                        }`}>
                          <p className="text-gray-500 text-xs mb-1">Price Impact</p>
                          <p className={`font-bold text-2xl ${
                            prediction.socialMedia.adjustmentPercent >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {prediction.socialMedia.adjustmentPercent >= 0 ? '↑' : '↓'}{Math.abs(prediction.socialMedia.adjustmentPercent).toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Google Trends */}
                      {prediction.socialMedia.googleTrends && (
                        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border border-cyan-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span className="text-cyan-300 text-sm font-medium">Google Trends</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-gray-500 text-xs">Interest Level</p>
                              <p className="text-white font-bold">{prediction.socialMedia.googleTrends.current_interest} / 100</p>
                            </div>
                            <span className={`text-sm font-medium px-3 py-1 rounded-lg ${
                              prediction.socialMedia.googleTrends.trend_direction === 'rising' 
                                ? 'bg-green-500/20 text-green-400' 
                                : prediction.socialMedia.googleTrends.trend_direction === 'falling'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {prediction.socialMedia.googleTrends.trend_direction === 'rising' ? '📈 Rising' : 
                               prediction.socialMedia.googleTrends.trend_direction === 'falling' ? '📉 Falling' : 
                               '➡️ Stable'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Factors Analyzed - Compact Footer */}
            {prediction?.factorsConsidered && prediction.factorsConsidered.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <p className="text-gray-400 text-sm">
                    Powered by <span className="text-indigo-400 font-medium">Driplytics AI</span>
                    {prediction.processingTime && <span className="text-gray-500"> • {prediction.processingTime.toFixed(2)}s</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {prediction.factorsConsidered.slice(0, 4).map((factor, idx) => (
                      <span key={idx} className="text-xs text-gray-400 bg-white/10 px-2 py-1 rounded-full">
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default SneakerDetails;

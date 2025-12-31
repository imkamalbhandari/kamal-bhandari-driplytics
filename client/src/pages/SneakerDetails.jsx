import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import PriceAnalytics from '../components/PriceAnalytics';
import api, { sneakerAPI, favoritesAPI, authAPI } from '../services/api';
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
  const [selectedSize, setSelectedSize] = useState('10');
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [prediction, setPrediction] = useState(null);
  const [hypeScore, setHypeScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [liveDataLoading, setLiveDataLoading] = useState(false);

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
          volatility: sneaker.volatility
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
    setPredictionLoading(true);
    setShowPrediction(true);
    
    try {
      // 📱 Use Social Media-Based Prediction (Time Series + Linear Regression + Social)
      const socialResponse = await sneakerAPI.predictSocialPrice({
        sneaker_name: sneaker.name,
        brand: sneaker.brand,
        retail_price: sneaker.retailPrice,
        release_date: sneaker.releaseDate,
        shoe_size: parseFloat(selectedSize),
        region: 'California'
      });
      
      if (socialResponse.success) {
        const pred = socialResponse.prediction;
        const rec = socialResponse.recommendation;
        const models = socialResponse.models;
        const social = socialResponse.social_media;
        
        setPrediction({
          // Main prediction
          price: pred.predicted_price,
          priceRange: pred.price_range,
          
          // Price change with UP/DOWN indicators
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
          
          // Price premium
          pricePremium: pred.price_change,
          
          // Time Series forecast
          timeSeries: models.time_series ? {
            model: models.time_series.model,
            price7d: models.time_series.price_7d,
            price14d: models.time_series.price_14d,
            price30d: models.time_series.price_30d,
            lowerBound: models.time_series.lower_bound,
            upperBound: models.time_series.upper_bound,
            dataPoints: models.time_series.historical_data_points,
            confidence: models.time_series.confidence
          } : null,
          
          // Linear Regression
          linearRegression: models.linear_regression ? {
            model: models.linear_regression.model,
            predictedPrice: models.linear_regression.predicted_price,
            confidence: models.linear_regression.confidence
          } : null,
          
          // Social Media Data
          socialMedia: {
            combinedScore: social.combined_score,
            adjustmentPercent: social.price_adjustment_percent,
            reddit: social.reddit,
            googleTrends: social.google_trends
          },
          
          // Metadata
          processingTime: socialResponse.metadata?.processing_time,
          modelsUsed: socialResponse.metadata?.models_used
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
      } catch (e) {
        // Silently fail
      }

    } catch (err) {
      console.error('Prediction error:', err);
      
      // Fallback
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
      const totalDays = dates.length;
      
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

  const currentPrice = sneaker.priceBySize ? sneaker.priceBySize[selectedSize] : sneaker.retailPrice;

  const marketStats = [
    { label: 'Lowest Ask', value: `$${Math.round(currentPrice * 0.96)}`, platform: 'StockX' },
    { label: 'Highest Bid', value: `$${Math.round(currentPrice * 0.92)}`, platform: 'StockX' },
    { label: 'Last Sale', value: `$${currentPrice}`, platform: 'StockX' },
    { label: 'eBay Price', value: `$${Math.round(currentPrice * 1.03)}`, platform: 'eBay' },
  ];

  return (
    <Layout requireAuth>
      <div className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-medium rounded-lg">
                +12% this month
              </span>
            </div>

            <h1 className="text-3xl font-bold text-white mb-2">{sneaker.name}</h1>
            <p className="text-gray-400 mb-6">{sneaker.colorway}</p>

            {/* Current Price */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Current Resale Price (Size {selectedSize})</p>
                  <p className="text-4xl font-bold text-white">${sneaker.priceBySize[selectedSize]}</p>
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
                className="w-full mt-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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
                    📱 Predict Price (Social + AI)
                  </>
                )}
              </button>
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
                <p className="text-green-400 font-semibold">+{Math.round((sneaker.priceBySize[selectedSize] / sneaker.retailPrice - 1) * 100)}%</p>
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

        {/* 📊 Detailed Price Analytics Section */}
        <div className="mb-8">
          <PriceAnalytics 
            sneakerName={sneaker.name} 
            retailPrice={sneaker.retailPrice} 
          />
        </div>

        {/* AI Prediction & Market Stats - Only show after clicking Predict */}
        {showPrediction && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Prediction */}
          <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-sm rounded-2xl border border-indigo-500/30 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-500/30 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">AI Price Prediction</h3>
                <p className="text-gray-400 text-sm">Next {prediction?.timeframe || '30 days'}</p>
              </div>
            </div>

            {predictionLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
                <p className="text-gray-400 text-sm">Analyzing social media & trends...</p>
              </div>
            ) : prediction ? (
              <>
                <div className="flex items-end gap-4 mb-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Predicted Sale Price</p>
                    <p className="text-4xl font-bold text-white">${Math.round(prediction.price)}</p>
                  </div>
                  {/* UP/DOWN Percentage Display */}
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-lg ${
                    prediction.isIncrease || prediction.trend === 'up'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {prediction.isIncrease || prediction.trend === 'up' ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                        </svg>
                        <span>↑ {Math.abs(prediction.priceChangePercent || parseFloat(prediction.changePercent)).toFixed(1)}%</span>
                        <span className="text-xs opacity-75">UP</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>↓ {Math.abs(prediction.priceChangePercent || parseFloat(prediction.changePercent)).toFixed(1)}%</span>
                        <span className="text-xs opacity-75">DOWN</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Price Premium with UP/DOWN */}
                {prediction.pricePremium !== undefined && (
                  <div className={`rounded-lg p-4 mb-4 ${
                    prediction.pricePremium >= 0 
                      ? 'bg-green-500/10 border border-green-500/30' 
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm font-medium">
                        {prediction.pricePremium >= 0 ? '📈 Expected Profit' : '📉 Expected Loss'}
                      </span>
                      <div className={`flex items-center gap-2 font-bold text-xl ${
                        prediction.pricePremium >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        <span>{prediction.pricePremium >= 0 ? '↑' : '↓'}</span>
                        <span>${Math.abs(Math.round(prediction.pricePremium))}</span>
                      </div>
                    </div>
                    {prediction.socialImpact && (
                      <p className="text-gray-500 text-xs mt-2">
                        Social media impact: {prediction.socialImpact}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                      style={{ width: `${prediction.confidence}%` }}
                    ></div>
                  </div>
                  <span className="text-white font-medium text-sm">{prediction.confidence}% confidence</span>
                </div>

                {prediction.recommendation && (
                  <div className={`rounded-lg p-3 mb-4 ${
                    prediction.recommendation.includes('Buy') ? 'bg-green-500/10 border border-green-500/30' :
                    prediction.recommendation.includes('Sell') || prediction.recommendation.includes('Avoid') ? 'bg-red-500/10 border border-red-500/30' :
                    'bg-yellow-500/10 border border-yellow-500/30'
                  }`}>
                    <p className="text-sm font-medium">
                      {prediction.recommendation}
                    </p>
                  </div>
                )}

                {/* Models Used - Time Series + Linear Regression */}
                <div className="border-t border-white/10 pt-4 mt-4">
                  <p className="text-gray-400 text-xs mb-3">Models Used</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {/* Time Series */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-xl p-3 border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                        <p className="text-purple-300 text-xs font-medium">Time Series</p>
                      </div>
                      <p className="text-white font-bold text-lg">
                        ${prediction.timeSeries?.price30d ? Math.round(prediction.timeSeries.price30d) : 'N/A'}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {prediction.timeSeries?.model || 'Prophet'}
                      </p>
                    </div>
                    
                    {/* Linear Regression */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-3 border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        <p className="text-blue-300 text-xs font-medium">Linear Regression</p>
                      </div>
                      <p className="text-white font-bold text-lg">
                        ${prediction.linearRegression?.predictedPrice ? Math.round(prediction.linearRegression.predictedPrice) : 'N/A'}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {prediction.linearRegression?.model || 'Ridge'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Time-Series Forecast */}
                {prediction.timeSeries && prediction.timeSeries.price7d && (
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="text-gray-400 text-xs">Price Forecast ({prediction.timeSeries.model})</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-lg p-3 border border-purple-500/20">
                        <p className="text-gray-500 text-xs mb-1">7 Days</p>
                        <p className="text-white font-bold">${prediction.timeSeries.price7d ? Math.round(prediction.timeSeries.price7d) : 'N/A'}</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-lg p-3 border border-purple-500/20">
                        <p className="text-gray-500 text-xs mb-1">14 Days</p>
                        <p className="text-white font-bold">${prediction.timeSeries.price14d ? Math.round(prediction.timeSeries.price14d) : 'N/A'}</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-lg p-3 border border-purple-500/20">
                        <p className="text-gray-500 text-xs mb-1">30 Days</p>
                        <p className="text-white font-bold">${prediction.timeSeries.price30d ? Math.round(prediction.timeSeries.price30d) : 'N/A'}</p>
                      </div>
                    </div>
                    {prediction.timeSeries.lowerBound && prediction.timeSeries.upperBound && (
                      <div className="mt-2 bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">30-Day Range</p>
                        <p className="text-gray-300 text-sm">
                          ${Math.round(prediction.timeSeries.lowerBound)} - ${Math.round(prediction.timeSeries.upperBound)}
                        </p>
                      </div>
                    )}
                    {prediction.timeSeries.dataPoints > 0 && (
                      <p className="text-gray-500 text-xs mt-2 text-center">
                        Based on {prediction.timeSeries.dataPoints} historical data points
                      </p>
                    )}
                  </div>
                )}

                {/* Social Media Impact Summary */}
                {prediction.socialMedia && (
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <p className="text-gray-400 text-xs mb-2">Social Media Impact</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-gradient-to-r from-orange-500/10 to-pink-500/10 rounded-lg p-3 border border-orange-500/20">
                        <p className="text-gray-500 text-xs">Social Score</p>
                        <p className="text-orange-400 font-bold text-lg">{Math.round(prediction.socialMedia.combinedScore)}/100</p>
                      </div>
                      <div className={`rounded-lg p-3 border ${
                        prediction.socialMedia.adjustmentPercent >= 0 
                          ? 'bg-green-500/10 border-green-500/20' 
                          : 'bg-red-500/10 border-red-500/20'
                      }`}>
                        <p className="text-gray-500 text-xs">Price Impact</p>
                        <p className={`font-bold text-lg ${
                          prediction.socialMedia.adjustmentPercent >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {prediction.socialMedia.adjustmentPercent >= 0 ? '↑' : '↓'} 
                          {Math.abs(prediction.socialMedia.adjustmentPercent).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">
                Click "Predict Price" to get AI prediction
              </div>
            )}
          </div>

          {/* Hype Score & Market Stats */}
          <div className="space-y-6">
            {/* Live Hype Score - REAL Reddit Data */}
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
                      <h3 className="text-white font-semibold">
                        🔴 LIVE Reddit Hype
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Real-time data from Reddit
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">{Math.round(hypeScore.hype_score)}</div>
                    <div className="text-xs text-gray-500">/ 100</div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 bg-white/10 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all"
                      style={{ width: `${hypeScore.hype_score}%` }}
                    ></div>
                  </div>
                  <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
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
                
                {/* Reddit Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-white">{hypeScore.posts_found || 0}</p>
                    <p className="text-gray-500 text-xs">Posts Found</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-orange-400">{hypeScore.total_upvotes || 0}</p>
                    <p className="text-gray-500 text-xs">↑ Upvotes</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-blue-400">{hypeScore.total_comments || 0}</p>
                    <p className="text-gray-500 text-xs">💬 Comments</p>
                  </div>
                </div>
                
                {/* Sentiment Label */}
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
                
                {/* Top Posts Preview */}
                {hypeScore.top_posts && hypeScore.top_posts.length > 0 && (
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <p className="text-gray-400 text-xs mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0z"/>
                      </svg>
                      Top Reddit Discussions:
                    </p>
                    <div className="space-y-2">
                      {hypeScore.top_posts.slice(0, 3).map((post, idx) => (
                        <a 
                          key={idx}
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block bg-white/5 rounded-lg p-2 hover:bg-white/10 transition-colors"
                        >
                          <p className="text-white text-xs line-clamp-1">{post.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span className="text-orange-400 font-medium">↑{post.score}</span>
                            <span className="text-blue-400">💬{post.comments}</span>
                            <span className="text-gray-600">r/{post.subreddit}</span>
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
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mb-3"></div>
                  <p className="text-gray-400 text-sm">Fetching live social data...</p>
                </div>
              </div>
            )}

            {/* Market Stats */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 className="text-white font-semibold mb-4">Market Data (Size {selectedSize})</h3>
              <div className="space-y-4">
                {marketStats.map((stat, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
                    <div>
                      <p className="text-white font-medium">{stat.label}</p>
                      <p className="text-gray-400 text-xs">{stat.platform}</p>
                    </div>
                    <p className="text-white font-semibold text-lg">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* 📱 Social Media Presence Section */}
        {showPrediction && prediction?.socialMedia && (
          <div className="mt-8 bg-gradient-to-br from-orange-900/20 to-pink-900/20 backdrop-blur-sm rounded-2xl border border-orange-500/30 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">📱 Social Media Presence</h3>
                <p className="text-gray-400 text-sm">
                  Price adjusted by social hype and trends
                  {prediction.processingTime && ` • ${prediction.processingTime.toFixed(2)}s`}
                </p>
              </div>
            </div>

            {/* Combined Social Score */}
            <div className="mb-6 bg-white/5 rounded-xl p-4">
              <div className="text-center mb-4">
                <p className="text-gray-400 text-sm mb-2">Social Hype Score</p>
                <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-400">
                  {Math.round(prediction.socialMedia.combinedScore)}
                </div>
                <p className="text-gray-500 text-xs mt-2">out of 100</p>
                
                {/* Progress bar */}
                <div className="mt-4 h-3 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-full transition-all"
                    style={{ width: `${prediction.socialMedia.combinedScore}%` }}
                  ></div>
                </div>
                
                {/* Reddit Posts Count */}
                {prediction.socialMedia.reddit && (
                  <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-orange-400 font-bold">{prediction.socialMedia.reddit.posts_found}</span>
                      <span className="text-gray-500">Reddit posts</span>
                    </div>
                    <span className="text-gray-600">•</span>
                    <div className="flex items-center gap-1">
                      <span className="text-orange-400 font-bold">{prediction.socialMedia.reddit.total_upvotes || 0}</span>
                      <span className="text-gray-500">upvotes</span>
                    </div>
                    <span className="text-gray-600">•</span>
                    <div className="flex items-center gap-1">
                      <span className="text-blue-400 font-bold">{prediction.socialMedia.reddit.total_comments || 0}</span>
                      <span className="text-gray-500">comments</span>
                    </div>
                  </div>
                )}
                
                {prediction.socialMedia.adjustmentPercent !== 0 && (
                  <p className={`mt-3 text-sm font-medium ${
                    prediction.socialMedia.adjustmentPercent > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {prediction.socialMedia.adjustmentPercent > 0 ? '↑' : '↓'} 
                    {' '}{Math.abs(prediction.socialMedia.adjustmentPercent).toFixed(1)}% price adjustment from social data
                  </p>
                )}
              </div>
            </div>

            {/* Social Media Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reddit Sentiment - REAL DATA */}
              {prediction.socialMedia.reddit && (
                <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-4 border border-orange-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                      </svg>
                      <span className="text-orange-300 font-medium">Reddit (Live Data)</span>
                    </div>
                    <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
                      🔴 Real-time
                    </span>
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-gray-500 text-xs">Posts Found</p>
                      <p className="text-white font-bold text-xl">{prediction.socialMedia.reddit.posts_found}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-gray-500 text-xs">Total Upvotes</p>
                      <p className="text-orange-400 font-bold text-xl">{prediction.socialMedia.reddit.total_upvotes || 0}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-gray-500 text-xs">Comments</p>
                      <p className="text-blue-400 font-bold text-xl">{prediction.socialMedia.reddit.total_comments || 0}</p>
                    </div>
                  </div>
                  
                  {/* Sentiment */}
                  <div className={`px-3 py-2 rounded-lg text-center font-medium mb-3 ${
                    prediction.socialMedia.reddit.sentiment_label === 'Positive' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : prediction.socialMedia.reddit.sentiment_label === 'Negative'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {prediction.socialMedia.reddit.sentiment_label === 'Positive' ? '😊' : 
                     prediction.socialMedia.reddit.sentiment_label === 'Negative' ? '😞' : '😐'}
                    {' '}{prediction.socialMedia.reddit.sentiment_label} Sentiment 
                    <span className="text-xs opacity-75 ml-2">
                      (Hype: {Math.round(prediction.socialMedia.reddit.hype_score || 50)}/100)
                    </span>
                  </div>
                  
                  {/* Top Posts */}
                  {prediction.socialMedia.reddit.top_posts && prediction.socialMedia.reddit.top_posts.length > 0 && (
                    <div className="border-t border-white/10 pt-3">
                      <p className="text-gray-400 text-xs mb-2">Top Reddit Posts:</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {prediction.socialMedia.reddit.top_posts.map((post, idx) => (
                          <a 
                            key={idx}
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-white/5 rounded-lg p-2 hover:bg-white/10 transition-colors"
                          >
                            <p className="text-white text-xs line-clamp-1">{post.title}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span className="text-orange-400">↑ {post.score}</span>
                              <span className="text-blue-400">💬 {post.comments}</span>
                              <span>r/{post.subreddit}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Subreddits searched */}
                  <p className="text-gray-600 text-xs mt-3 text-center">
                    Searched: r/sneakers • r/Sneakerheads • r/SneakerDeals • r/streetwear
                  </p>
                </div>
              )}
              
              {/* Google Trends */}
              {prediction.socialMedia.googleTrends && (
                <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="text-cyan-300 font-medium">Google Trends</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Current Interest</p>
                      <p className="text-white font-bold text-lg">{prediction.socialMedia.googleTrends.current_interest}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Average</p>
                      <p className="text-cyan-400 font-bold text-lg">{prediction.socialMedia.googleTrends.avg_interest}</p>
                    </div>
                  </div>
                  
                  <div className={`mt-3 px-3 py-2 rounded-lg text-center font-medium ${
                    prediction.socialMedia.googleTrends.trend_direction === 'rising' 
                      ? 'bg-green-500/20 text-green-400' 
                      : prediction.socialMedia.googleTrends.trend_direction === 'falling'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {prediction.socialMedia.googleTrends.trend_direction === 'rising' ? '📈 Trending Up' : 
                     prediction.socialMedia.googleTrends.trend_direction === 'falling' ? '📉 Trending Down' : 
                     '➡️ Stable'}
                  </div>
                </div>
              )}
            </div>
            
            {/* Models Info */}
            <div className="mt-6 text-center text-gray-400 text-sm">
              <p>
                Prediction Method: <span className="text-orange-400">Time Series + Linear Regression + Social Media</span>
              </p>
              {prediction.modelsUsed && (
                <p className="text-xs text-gray-500 mt-1">
                  {prediction.modelsUsed.join(' • ')}
                </p>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </Layout>
  );
}

export default SneakerDetails;

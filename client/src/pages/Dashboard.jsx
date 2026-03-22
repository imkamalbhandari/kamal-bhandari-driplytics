import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { sneakerAPI } from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function Dashboard() {
  const navigate = useNavigate();
  const user = (() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  })();

  const [timeRange, setTimeRange] = useState('7d');
  const [trendingSneakers, setTrendingSneakers] = useState([]);
  const [stats, setStats] = useState([
    { label: 'Total Sneakers Tracked', value: '...', change: '', positive: true },
    { label: 'Average Price', value: '...', change: '', positive: true },
    { label: 'Price Predictions', value: '...', change: '', positive: true },
    { label: 'Saved Favorites', value: '0', change: '', positive: true },
  ]);
  const [recentPredictions, setRecentPredictions] = useState([]);
  const [trendChartData, setTrendChartData] = useState({
    labels: [],
    datasets: [{
      label: 'Hype Score',
      data: [],
      backgroundColor: [],
      borderRadius: 8,
    }],
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [redditPosts, setRedditPosts] = useState([]);

  // Fetch real data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch stats (includes top_sneakers with real prices)
        const statsResponse = await sneakerAPI.getStats();
        if (statsResponse.success && statsResponse.data) {
          const data = statsResponse.data;
          
          // Set stats with real data
          setStats([
            { label: 'Total Sneakers Tracked', value: data.total_sneakers?.toLocaleString() || '0', change: '', positive: true },
            { label: 'Average Price', value: `$${Math.round(data.average_price || 0)}`, change: `+${Math.round(data.avg_premium || 0)}%`, positive: data.avg_premium > 0 },
            { label: 'Highest Price', value: `$${Math.round(data.max_price || 0)}`, change: '', positive: true },
            { label: 'Total Brands', value: data.brands?.length?.toString() || '0', change: '', positive: true },
          ]);

          // Use top_sneakers for trending (has real prices and hype scores)
          if (data.top_sneakers && data.top_sneakers.length > 0) {
            // Set trending sneakers with REAL prices
            const trending = data.top_sneakers.slice(0, 3).map((item) => ({
              name: item.shoe_name?.replace(/-/g, ' ') || item.name,
              price: `$${Math.round(item.avg_price || item.retail_price || 0)}`,
              change: `+${Math.round((item.sentiment_score || 0) * 100)}%`,
            }));
            setTrendingSneakers(trending);

            // Set chart data with real hype scores
            const topFive = data.top_sneakers.slice(0, 5);
            setTrendChartData({
              labels: topFive.map(item => {
                const name = item.shoe_name || item.name || '';
                return name.replace(/-/g, ' ').split(' ').slice(0, 3).join(' ');
              }),
              datasets: [{
                label: 'Hype Score',
                data: topFive.map(item => Math.round(item.hype_score || 0)),
                backgroundColor: [
                  'rgba(99, 102, 241, 0.8)',
                  'rgba(139, 92, 246, 0.8)',
                  'rgba(168, 85, 247, 0.8)',
                  'rgba(192, 132, 252, 0.8)',
                  'rgba(216, 180, 254, 0.8)',
                ],
                borderRadius: 8,
              }],
            });

            // Set recent predictions with REAL price data
            const predictions = data.top_sneakers.slice(0, 4).map((item) => ({
              name: item.shoe_name?.replace(/-/g, ' ') || item.name,
              currentPrice: `$${Math.round(item.avg_price || 0)}`,
              prediction: `$${Math.round((item.avg_price || 0) * 1.1)}`, // Estimated 10% increase
              confidence: Math.min(95, Math.round(item.hype_score || 70)),
              trend: item.hype_score > 80 ? 'up' : item.hype_score > 50 ? 'stable' : 'down',
            }));
            setRecentPredictions(predictions);
          }
        }

        // Fetch live Reddit discussions
        try {
          const redditRes = await sneakerAPI.getRedditHot();
          if (redditRes.success && redditRes.data?.posts) {
            setRedditPosts(redditRes.data.posts.slice(0, 3));
          }
        } catch {
          // Reddit fetch is optional
        }

        setLastUpdated(new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Set fallback data
        setTrendingSneakers([
          { name: 'Air Force 1', price: '$347', change: '+11%' },
          { name: 'Air Jordan 1', price: '$247', change: '+4%' },
          { name: 'Nike Dunk Low', price: '$223', change: '+3%' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    
    // Refresh data every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Price chart data
  const priceChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Average Price',
        data: [320, 335, 342, 338, 355, 362, 358],
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
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
        },
      },
    },
  };

  return (
    <Layout requireAuth>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{user?.username}</span>
            </h1>
            <p className="text-gray-400">Live sneaker market data from StockX, Reddit & Google Trends</p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-gray-500 text-sm hidden sm:block">Updated: {lastUpdated}</span>
            )}
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm border border-green-500/30 shadow-lg shadow-green-500/10">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="font-medium">Live</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="group bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-indigo-500/40 transition-all duration-300 card-hover glow-on-hover animate-scale-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <p className="text-gray-400 text-sm mb-2 font-medium">{stat.label}</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-white group-hover:text-indigo-300 transition-colors">{stat.value}</p>
                {stat.change && (
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-lg ${stat.positive ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                    {stat.change}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Price Trend Chart */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-indigo-500/30 transition-all duration-300 animate-slide-up shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Price Trends
              </h2>
              <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                {['7d', '30d', '90d'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      timeRange === range
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64">
              <Line data={priceChartData} options={chartOptions} />
            </div>
          </div>

          {/* Trending Models Chart */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-purple-500/30 transition-all duration-300 animate-slide-up shadow-xl" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Top Trending Models
              </h2>
              <Link to="/trends" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1 group">
                View all 
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="h-64">
              <Bar data={trendChartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Predictions */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-indigo-500/30 transition-all duration-300 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Top Sneakers - Price Predictions
              </h2>
              <Link to="/search" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1 group">
                Get more predictions 
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                </div>
              ) : recentPredictions.length > 0 ? (
                recentPredictions.map((item, index) => (
                  <div
                    key={index}
                    className="group flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all duration-300 cursor-pointer border border-transparent hover:border-indigo-500/20 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm group-hover:text-indigo-300 transition-colors">{item.name}</p>
                        <div className="flex items-center gap-2 text-xs mt-1">
                          <span className="text-gray-400">Current: <span className="text-white font-medium">{item.currentPrice}</span></span>
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span className="text-green-400 font-semibold">Predicted: {item.prediction}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold px-2 py-0.5 rounded-lg ${item.confidence > 80 ? 'text-green-400 bg-green-500/10' : item.confidence > 60 ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-400 bg-gray-500/10'}`}>
                          {item.confidence}% hype
                        </span>
                        {item.trend === 'up' && (
                          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                        {item.trend === 'stable' && (
                          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                          </svg>
                        )}
                        {item.trend === 'down' && (
                          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-8">No predictions available</p>
              )}
            </div>
          </div>

          {/* Trending Now */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-orange-500/30 transition-all duration-300 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="text-xl">🔥</span>
                Trending Now
              </h2>
            </div>
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                </div>
              ) : trendingSneakers.length > 0 ? (
                trendingSneakers.map((item, index) => (
                  <div
                    key={index}
                    className="group p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all duration-300 cursor-pointer border border-transparent hover:border-orange-500/20 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-500 text-xs font-medium px-2 py-0.5 bg-white/5 rounded-full">#{index + 1} Trending</span>
                      <span className="text-green-400 text-xs font-semibold">{item.change}</span>
                    </div>
                    <p className="text-white font-medium text-sm mb-2 group-hover:text-indigo-300 transition-colors">{item.name}</p>
                    <p className="text-indigo-400 font-bold text-lg">{item.price}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-8">No trending data available</p>
              )}
            </div>
            <Link
              to="/trends"
              className="mt-5 flex items-center justify-center gap-2 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all text-sm font-medium border border-white/5 hover:border-white/10 group"
            >
              View All Trends
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Live Reddit Discussions */}
        {redditPosts.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-orange-500/10 to-red-500/10 backdrop-blur-sm rounded-2xl p-6 border border-orange-500/20 shadow-xl animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Live Reddit Discussions</h2>
                  <span className="text-orange-400/80 text-xs">Real-time from r/Sneakers</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {redditPosts.map((post, idx) => (
                <a 
                  key={idx} 
                  href={post.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group block p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-transparent hover:border-orange-500/20"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-white font-medium text-sm truncate flex-1 mr-4 group-hover:text-orange-300 transition-colors">{post.title}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400 flex-shrink-0">
                      <span className="text-orange-400 font-semibold flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        {post.score}
                      </span>
                      <span className="flex items-center gap-1">💬 {post.num_comments}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Dashboard;

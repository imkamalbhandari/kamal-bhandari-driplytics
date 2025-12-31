import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

  // Fetch real data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch stats
        const statsResponse = await sneakerAPI.getStats();
        if (statsResponse.success) {
          const data = statsResponse.data;
          setStats([
            { label: 'Total Sneakers Tracked', value: data.total_sneakers?.toLocaleString() || '0', change: '+12%', positive: true },
            { label: 'Average Price', value: `$${Math.round(data.average_price || 0)}`, change: '+5.2%', positive: true },
            { label: 'Highest Price', value: `$${Math.round(data.max_price || 0)}`, change: '', positive: true },
            { label: 'Total Brands', value: data.brands?.length?.toString() || '0', change: '', positive: true },
          ]);
        }

        // Fetch hype scores for trending sneakers
        const hypeResponse = await sneakerAPI.getAllHypeScores();
        if (hypeResponse.success && hypeResponse.data) {
          // Sort by hype score and get top 5
          const sortedHype = Object.entries(hypeResponse.data)
            .map(([name, score]) => ({ name, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

          // Set trending sneakers
          const trending = sortedHype.slice(0, 3).map((item, index) => ({
            name: item.name,
            price: `$${Math.round(150 + item.score * 3)}`,
            change: `+${Math.round(item.score / 10)}%`,
          }));
          setTrendingSneakers(trending);

          // Set chart data
          setTrendChartData({
            labels: sortedHype.map(item => item.name.split(' ').slice(0, 2).join(' ')),
            datasets: [{
              label: 'Hype Score',
              data: sortedHype.map(item => Math.round(item.score)),
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

          // Set recent predictions based on hype data
          const predictions = sortedHype.slice(0, 4).map((item, index) => ({
            name: item.name,
            prediction: `$${Math.round(150 + item.score * 3)}`,
            confidence: Math.min(95, Math.round(70 + item.score / 5)),
            trend: item.score > 50 ? 'up' : item.score > 30 ? 'stable' : 'down',
          }));
          setRecentPredictions(predictions);
        }
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
      <div className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, <span className="text-indigo-400">{user?.username}</span>
          </h1>
          <p className="text-gray-400">Here's what's happening in the sneaker market today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-indigo-500/30 transition-all"
            >
              <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <span className={`text-sm font-medium ${stat.positive ? 'text-green-400' : 'text-red-400'}`}>
                  {stat.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Price Trend Chart */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Price Trends</h2>
              <div className="flex gap-2">
                {['7d', '30d', '90d'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
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
            <div className="h-64">
              <Line data={priceChartData} options={chartOptions} />
            </div>
          </div>

          {/* Trending Models Chart */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Top Trending Models</h2>
              <Link to="/trends" className="text-indigo-400 hover:text-indigo-300 text-sm">
                View all →
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
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Recent Predictions</h2>
              <Link to="/search" className="text-indigo-400 hover:text-indigo-300 text-sm">
                Get more predictions →
              </Link>
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : recentPredictions.length > 0 ? (
                recentPredictions.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-medium">{item.name}</p>
                        <p className="text-gray-400 text-sm">Predicted price: {item.prediction}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 text-sm font-medium">{item.confidence}% confidence</span>
                        {item.trend === 'up' && (
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                        {item.trend === 'down' && (
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-4">No predictions available</p>
              )}
            </div>
          </div>

          {/* Trending Now */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Trending Now 🔥</h2>
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : trendingSneakers.length > 0 ? (
                trendingSneakers.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-xs">#{index + 1} Trending</span>
                      <span className="text-green-400 text-xs font-medium">{item.change}</span>
                    </div>
                    <p className="text-white font-medium text-sm mb-1">{item.name}</p>
                    <p className="text-indigo-400 font-semibold">{item.price}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-4">No trending data available</p>
              )}
            </div>
            <Link
              to="/trends"
              className="mt-4 block w-full py-3 text-center bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all text-sm font-medium"
            >
              View All Trends
            </Link>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;

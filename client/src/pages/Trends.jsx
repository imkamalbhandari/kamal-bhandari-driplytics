import { useState, useEffect } from 'react';
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

function Trends() {
  const [activeTab, setActiveTab] = useState('trending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Live data states
  const [trendingModels, setTrendingModels] = useState([]);
  const [topGainers, setTopGainers] = useState([]);
  const [topLosers, setTopLosers] = useState([]);
  const [marketStats, setMarketStats] = useState({
    avgPrice: 0,
    totalSneakers: 0,
    totalBrands: 0
  });
  const [brandData, setBrandData] = useState({ labels: [], data: [] });
  const [redditHot, setRedditHot] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch live data from APIs
  useEffect(() => {
    const fetchLiveData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch multiple data sources in parallel
        const [statsRes, redditRes] = await Promise.allSettled([
          sneakerAPI.getStats(),
          sneakerAPI.getRedditHot()
        ]);

        // Process market stats
        if (statsRes.status === 'fulfilled' && statsRes.value.success) {
          const stats = statsRes.value.data;
          setMarketStats({
            avgPrice: Math.round(stats.average_price || 0),
            totalSneakers: stats.total_sneakers || 0,
            totalBrands: stats.brands?.length || 0
          });
          
          // Brand distribution from stats
          if (stats.brand_counts) {
            const sortedBrands = Object.entries(stats.brand_counts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6);
            setBrandData({
              labels: sortedBrands.map(([name]) => name),
              data: sortedBrands.map(([, count]) => count)
            });
          }

          // Create trending data from top brands stats
          if (stats.top_sneakers && stats.top_sneakers.length > 0) {
            const trending = stats.top_sneakers.slice(0, 10).map((s, idx) => ({
              rank: idx + 1,
              name: s.shoe_name || s.Name || s.name || 'Unknown',
              brand: s.brand || s.Brand || 'Unknown',
              price: `$${Math.round(s.avg_price || s.AvgSalePrice || s.retail_price || 0)}`,
              change: s.sentiment_score ? `${s.sentiment_score >= 0 ? '+' : ''}${(s.sentiment_score * 100).toFixed(1)}%` : '+0%',
              volume: s.comment_count ? `${(s.comment_count / 1000).toFixed(1)}K` : 'N/A',
              hypeScore: s.hype_score || 50
            }));
            setTrendingModels(trending);

            // For gainers/losers, use sentiment_score as proxy for price change
            const sortedBySentiment = [...stats.top_sneakers].sort((a, b) => (b.sentiment_score || 0) - (a.sentiment_score || 0));
            
            // Gainers - top positive sentiment
            const gainers = sortedBySentiment
              .filter(s => s.sentiment_score && s.sentiment_score > 0)
              .slice(0, 4)
              .map(s => {
                const currentPrice = Math.round(s.avg_price || s.retail_price || 0);
                const changePct = s.sentiment_score || 0;
                const previousPrice = Math.round(currentPrice / (1 + changePct));
                return {
                  name: s.shoe_name || s.name,
                  price: `$${currentPrice}`,
                  change: `+${(changePct * 100).toFixed(1)}%`,
                  previousPrice: `$${previousPrice}`
                };
              });
            setTopGainers(gainers);

            // Losers - lowest sentiment (or just bottom of list if all positive)
            const losers = sortedBySentiment
              .slice(-4)
              .reverse()
              .map(s => {
                const currentPrice = Math.round(s.avg_price || s.retail_price || 0);
                const changePct = s.sentiment_score || 0;
                const previousPrice = Math.round(currentPrice / (1 + Math.abs(changePct)));
                return {
                  name: s.shoe_name || s.name,
                  price: `$${currentPrice}`,
                  change: changePct < 0 ? `${(changePct * 100).toFixed(1)}%` : `+${(changePct * 100).toFixed(1)}%`,
                  previousPrice: `$${previousPrice}`
                };
              });
            setTopLosers(losers);
          }
        }

        // Process Reddit hot posts
        if (redditRes.status === 'fulfilled' && redditRes.value.success) {
          setRedditHot(redditRes.value.data?.posts?.slice(0, 5) || []);
        }

        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err) {
        console.error('Error fetching trends data:', err);
        setError('Failed to load live data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchLiveData();
    
    // Refresh data every 5 minutes
    const interval = setInterval(fetchLiveData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Brand performance chart data
  const brandPerformance = {
    labels: brandData.labels.length > 0 ? brandData.labels : ['Loading...'],
    datasets: [
      {
        label: 'Sneaker Count',
        data: brandData.data.length > 0 ? brandData.data : [0],
        backgroundColor: [
          'rgba(99, 102, 241, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
        borderRadius: 8,
      },
    ],
  };

  // Price trend from trending models hype scores
  const priceIndexData = {
    labels: trendingModels.slice(0, 6).map(m => m.name?.split(' ').slice(0, 2).join(' ') || 'N/A'),
    datasets: [
      {
        label: 'Hype Score',
        data: trendingModels.slice(0, 6).map(m => m.hypeScore || 0),
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
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
      },
    },
  };

  return (
    <Layout requireAuth>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Market Trends</h1>
            <p className="text-gray-400">Live data from StockX, Reddit & Google Trends</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-gray-500 text-sm">Updated: {lastUpdated}</span>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live Data
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <p className="text-gray-400">Loading live market data...</p>
          </div>
        ) : (
          <>
        {/* Market Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-gray-400 text-sm">Total Sneakers</span>
            </div>
            <p className="text-2xl font-bold text-white">{marketStats.totalSneakers.toLocaleString()}</p>
            <p className="text-indigo-400 text-sm">In database</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-gray-400 text-sm">Avg. Price</span>
            </div>
            <p className="text-2xl font-bold text-white">${marketStats.avgPrice}</p>
            <p className="text-green-400 text-sm">Live from StockX</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-gray-400 text-sm">Total Brands</span>
            </div>
            <p className="text-2xl font-bold text-white">{marketStats.totalBrands}</p>
            <p className="text-purple-400 text-sm">Tracked brands</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
              <span className="text-gray-400 text-sm">Reddit Discussions</span>
            </div>
            <p className="text-2xl font-bold text-white">{redditHot.length > 0 ? `${redditHot.length}+` : '0'}</p>
            <p className="text-orange-400 text-sm">Hot posts today</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Top Sneakers by Hype Score</h2>
            <div className="h-64">
              <Line data={priceIndexData} options={chartOptions} />
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Brand Distribution (Live)</h2>
            <div className="h-64">
              <Bar data={brandPerformance} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Reddit Hot Discussions */}
        {redditHot.length > 0 && (
          <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 backdrop-blur-sm rounded-2xl p-6 border border-orange-500/20 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
              </svg>
              <h2 className="text-lg font-semibold text-white">🔥 Hot Reddit Discussions (Live)</h2>
            </div>
            <div className="space-y-3">
              {redditHot.map((post, idx) => (
                <a 
                  key={idx} 
                  href={post.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-white font-medium text-sm truncate flex-1 mr-4">{post.title}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="text-orange-400">↑{post.score}</span>
                      <span>💬{post.num_comments}</span>
                      <span className="text-gray-500">r/{post.subreddit}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'trending', label: '🔥 Trending' },
            { id: 'gainers', label: '📈 Top Gainers' },
            { id: 'losers', label: '📉 Top Losers' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Trending Table */}
        {activeTab === 'trending' && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">#</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Sneaker</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Brand</th>
                    <th className="text-right text-gray-400 text-sm font-medium px-6 py-4">Price</th>
                    <th className="text-right text-gray-400 text-sm font-medium px-6 py-4">Change</th>
                    <th className="text-right text-gray-400 text-sm font-medium px-6 py-4">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {trendingModels.map((item) => (
                    <tr key={item.rank} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <span className={`font-bold ${item.rank <= 3 ? 'text-indigo-400' : 'text-gray-400'}`}>
                          {item.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white font-medium">{item.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs font-medium rounded-lg">
                          {item.brand}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-white font-semibold">{item.price}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-green-400 font-medium">{item.change}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-400">{item.volume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Gainers */}
        {activeTab === 'gainers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topGainers.map((item, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-green-500/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-lg">
                    #{index + 1} Gainer
                  </span>
                  <span className="text-green-400 font-bold text-lg">{item.change}</span>
                </div>
                <h3 className="text-white font-semibold mb-2">{item.name}</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Current</p>
                    <p className="text-white font-bold text-xl">{item.price}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">Previous</p>
                    <p className="text-gray-400 line-through">{item.previousPrice}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Top Losers */}
        {activeTab === 'losers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topLosers.map((item, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-red-500/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded-lg">
                    #{index + 1} Loser
                  </span>
                  <span className="text-red-400 font-bold text-lg">{item.change}</span>
                </div>
                <h3 className="text-white font-semibold mb-2">{item.name}</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Current</p>
                    <p className="text-white font-bold text-xl">{item.price}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">Previous</p>
                    <p className="text-gray-400 line-through">{item.previousPrice}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default Trends;

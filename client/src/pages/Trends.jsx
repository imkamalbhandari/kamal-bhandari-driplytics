import { useState } from 'react';
import Layout from '../components/layout/Layout';
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

  // Sample trending data
  const trendingModels = [
    { rank: 1, name: 'Travis Scott x Jordan 1 Low "Mocha"', brand: 'Jordan', price: '$1,245', change: '+15%', volume: '2.4K' },
    { rank: 2, name: 'Off-White x Nike Dunk Low "Lot 50"', brand: 'Nike', price: '$892', change: '+8%', volume: '1.8K' },
    { rank: 3, name: 'Jordan 4 Retro "Military Black"', brand: 'Jordan', price: '$285', change: '+12%', volume: '3.2K' },
    { rank: 4, name: 'New Balance 2002R "Protection Pack"', brand: 'New Balance', price: '$198', change: '+6%', volume: '1.5K' },
    { rank: 5, name: 'Yeezy Slide "Onyx"', brand: 'Yeezy', price: '$145', change: '+4%', volume: '2.1K' },
    { rank: 6, name: 'Nike Dunk Low "Panda"', brand: 'Nike', price: '$165', change: '+5%', volume: '4.5K' },
    { rank: 7, name: 'Jordan 1 Retro High OG "Chicago"', brand: 'Jordan', price: '$385', change: '+10%', volume: '2.8K' },
    { rank: 8, name: 'Asics Gel-Kayano 14 "Silver"', brand: 'Asics', price: '$175', change: '+18%', volume: '890' },
  ];

  const topGainers = [
    { name: 'Asics Gel-Kayano 14 "Silver"', price: '$175', change: '+18%', previousPrice: '$148' },
    { name: 'Travis Scott x Jordan 1 Low "Mocha"', price: '$1,245', change: '+15%', previousPrice: '$1,082' },
    { name: 'Jordan 4 Retro "Military Black"', price: '$285', change: '+12%', previousPrice: '$254' },
    { name: 'Jordan 1 Retro High OG "Chicago"', price: '$385', change: '+10%', previousPrice: '$350' },
  ];

  const topLosers = [
    { name: 'Yeezy Boost 700 "Wave Runner"', price: '$285', change: '-12%', previousPrice: '$324' },
    { name: 'Nike Air Max 1 "Patta"', price: '$245', change: '-8%', previousPrice: '$266' },
    { name: 'Adidas Samba OG', price: '$95', change: '-5%', previousPrice: '$100' },
    { name: 'Nike Air Force 1 Low "White"', price: '$85', change: '-4%', previousPrice: '$89' },
  ];

  const brandPerformance = {
    labels: ['Jordan', 'Nike', 'Yeezy', 'New Balance', 'Adidas', 'Asics'],
    datasets: [
      {
        label: 'Market Share',
        data: [32, 28, 15, 12, 8, 5],
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

  const priceIndexData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Sneaker Price Index',
        data: [100, 105, 102, 108, 115, 120],
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
      <div className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Market Trends</h1>
          <p className="text-gray-400">Track what's hot in the sneaker market</p>
        </div>

        {/* Market Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-gray-400 text-sm">Market Index</span>
            </div>
            <p className="text-2xl font-bold text-white">120.5</p>
            <p className="text-green-400 text-sm">+5.2% this month</p>
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
            <p className="text-2xl font-bold text-white">$342</p>
            <p className="text-green-400 text-sm">+8% from last week</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-gray-400 text-sm">Total Volume</span>
            </div>
            <p className="text-2xl font-bold text-white">24.5K</p>
            <p className="text-green-400 text-sm">+12% sales today</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
              <span className="text-gray-400 text-sm">Hot Releases</span>
            </div>
            <p className="text-2xl font-bold text-white">8</p>
            <p className="text-orange-400 text-sm">This week</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Price Index Trend</h2>
            <div className="h-64">
              <Line data={priceIndexData} options={chartOptions} />
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Brand Market Share</h2>
            <div className="h-64">
              <Bar data={brandPerformance} options={chartOptions} />
            </div>
          </div>
        </div>

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
        </div>
      </div>
    </Layout>
  );
}

export default Trends;

import { useState, useEffect } from 'react';
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

function PriceAnalytics({ sneakerName, retailPrice }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [chartPeriod, setChartPeriod] = useState('daily');

  useEffect(() => {
    if (sneakerName && sneakerName !== 'Loading...') {
      fetchAnalytics();
    }
  }, [sneakerName]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await sneakerAPI.getPriceAnalytics(sneakerName);
      if (response.success) {
        setAnalytics(response);
      } else {
        setError(response.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError('Unable to load price analytics');
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-gray-400">Loading price analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
        <div className="text-center py-8">
          <p className="text-gray-400">{error || 'No analytics available'}</p>
          <button 
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { statistics, trend_analysis, volatility, roi_metrics, technical_indicators, price_distribution, charts } = analytics;

  // Get chart data based on selected period
  const getChartData = () => {
    const data = charts[chartPeriod] || charts.daily;
    return {
      labels: data.dates?.map(d => {
        const date = new Date(d);
        return chartPeriod === 'monthly' 
          ? date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }) || [],
      datasets: [
        {
          label: 'Avg Price',
          data: data.avg_prices || data.prices || [],
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
        },
        ...(data.max_prices ? [{
          label: 'Max Price',
          data: data.max_prices,
          borderColor: 'rgba(34, 197, 94, 0.7)',
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: 0,
        }] : []),
        ...(data.min_prices ? [{
          label: 'Min Price',
          data: data.min_prices,
          borderColor: 'rgba(239, 68, 68, 0.7)',
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: 0,
        }] : []),
      ]
    };
  };

  // Volume chart data
  const getVolumeData = () => {
    const data = charts[chartPeriod] || charts.daily;
    return {
      labels: data.dates?.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) || [],
      datasets: [{
        label: 'Sales Volume',
        data: data.volumes || [],
        backgroundColor: 'rgba(99, 102, 241, 0.6)',
        borderRadius: 4,
      }]
    };
  };

  // RSI chart data
  const getRSIData = () => {
    const rsi = technical_indicators?.rsi || [];
    return {
      labels: rsi.map((_, i) => i + 1),
      datasets: [{
        label: 'RSI',
        data: rsi,
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: true,
        tension: 0.4,
      }]
    };
  };

  // Distribution chart data
  const getDistributionData = () => {
    return {
      labels: price_distribution?.bin_labels || [],
      datasets: [{
        label: 'Frequency',
        data: price_distribution?.counts || [],
        backgroundColor: 'rgba(139, 92, 246, 0.6)',
        borderRadius: 4,
      }]
    };
  };

  // Size analysis chart
  const getSizeData = () => {
    const sizeData = charts.by_size || {};
    return {
      labels: sizeData.sizes?.map(s => `US ${s}`) || [],
      datasets: [{
        label: 'Avg Price by Size',
        data: sizeData.avg_prices || [],
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderRadius: 4,
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: 'rgba(255,255,255,0.7)' } },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        borderColor: 'rgba(99, 102, 241, 0.5)',
        borderWidth: 1,
      },
    },
    scales: {
      x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: 'rgba(255, 255, 255, 0.6)' } },
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: 'rgba(255, 255, 255, 0.6)', callback: (v) => `$${v}` } },
    },
  };

  const volumeOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: { ...chartOptions.scales.y, ticks: { color: 'rgba(255, 255, 255, 0.6)' } }
    }
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'charts', label: '📈 Charts' },
    { id: 'technical', label: '🔧 Technical' },
    { id: 'roi', label: '💰 ROI' },
  ];

  return (
    <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 backdrop-blur-sm rounded-2xl border border-indigo-500/30 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Price Analytics</h3>
            <p className="text-gray-400 text-sm">
              {statistics?.data_points || 0} data points • {statistics?.date_range?.days || 0} days
            </p>
          </div>
        </div>
        
        {/* Trend Badge */}
        <div className={`px-4 py-2 rounded-xl font-bold ${
          trend_analysis?.is_uptrend 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {trend_analysis?.trend_emoji} {trend_analysis?.trend_description}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-gray-500 text-xs mb-1">Current Price</p>
              <p className="text-2xl font-bold text-white">${statistics?.current_price}</p>
              <p className={`text-xs mt-1 ${statistics?.premium_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {statistics?.premium_percent >= 0 ? '↑' : '↓'} {Math.abs(statistics?.premium_percent)}% from retail
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-gray-500 text-xs mb-1">Average Price</p>
              <p className="text-2xl font-bold text-indigo-400">${statistics?.avg_price}</p>
              <p className="text-xs text-gray-500 mt-1">Median: ${statistics?.median_price}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-gray-500 text-xs mb-1">Price Range</p>
              <p className="text-lg font-bold text-white">${statistics?.min_price} - ${statistics?.max_price}</p>
              <p className="text-xs text-gray-500 mt-1">Range: ${statistics?.price_range}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-gray-500 text-xs mb-1">Total Sales</p>
              <p className="text-2xl font-bold text-purple-400">{statistics?.total_sales?.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">~{statistics?.avg_daily_volume}/day</p>
            </div>
          </div>

          {/* Volatility & Trend */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Volatility Card */}
            <div className="bg-white/5 rounded-xl p-4">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <span className="text-orange-400">⚡</span> Volatility
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 text-xs">Daily</p>
                  <p className="text-white font-bold">{volatility?.daily_volatility}%</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Annualized</p>
                  <p className="text-orange-400 font-bold">{volatility?.annualized_volatility}%</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Max Drawdown</p>
                  <p className="text-red-400 font-bold">-{volatility?.max_drawdown}%</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Avg Daily Change</p>
                  <p className="text-white font-bold">±{volatility?.avg_daily_change}%</p>
                </div>
              </div>
            </div>

            {/* Trend Card */}
            <div className="bg-white/5 rounded-xl p-4">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                {trend_analysis?.trend_emoji} Trend Analysis
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 text-xs">Direction</p>
                  <p className={`font-bold ${trend_analysis?.is_uptrend ? 'text-green-400' : 'text-red-400'}`}>
                    {trend_analysis?.is_uptrend ? '↑ Uptrend' : '↓ Downtrend'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Strength</p>
                  <p className="text-white font-bold">{trend_analysis?.strength}/100</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Momentum (7d)</p>
                  <p className={`font-bold ${trend_analysis?.momentum >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trend_analysis?.momentum >= 0 ? '+' : ''}{trend_analysis?.momentum}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Accelerating?</p>
                  <p className={`font-bold ${trend_analysis?.is_accelerating ? 'text-green-400' : 'text-yellow-400'}`}>
                    {trend_analysis?.is_accelerating ? '🚀 Yes' : '➡️ No'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Support/Resistance */}
          {technical_indicators?.support_resistance && (
            <div className="bg-white/5 rounded-xl p-4">
              <h4 className="text-white font-semibold mb-3">📍 Support & Resistance Levels</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-xs mb-2">Support (Buy Zones)</p>
                  <div className="flex flex-wrap gap-2">
                    {technical_indicators.support_resistance.support?.map((level, i) => (
                      <span key={i} className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium">
                        ${level}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-2">Resistance (Sell Zones)</p>
                  <div className="flex flex-wrap gap-2">
                    {technical_indicators.support_resistance.resistance?.map((level, i) => (
                      <span key={i} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium">
                        ${level}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Tab */}
      {activeTab === 'charts' && (
        <div className="space-y-6">
          {/* Period Selector */}
          <div className="flex gap-2">
            {['daily', 'weekly', 'monthly'].map(period => (
              <button
                key={period}
                onClick={() => setChartPeriod(period)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  chartPeriod === period
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          {/* Price Chart */}
          <div className="bg-white/5 rounded-xl p-4">
            <h4 className="text-white font-semibold mb-4">Price History</h4>
            <div className="h-72">
              <Line data={getChartData()} options={chartOptions} />
            </div>
          </div>

          {/* Volume Chart */}
          <div className="bg-white/5 rounded-xl p-4">
            <h4 className="text-white font-semibold mb-4">Sales Volume</h4>
            <div className="h-48">
              <Bar data={getVolumeData()} options={volumeOptions} />
            </div>
          </div>

          {/* Price Distribution */}
          <div className="bg-white/5 rounded-xl p-4">
            <h4 className="text-white font-semibold mb-4">Price Distribution</h4>
            <div className="h-48">
              <Bar data={getDistributionData()} options={volumeOptions} />
            </div>
            <div className="mt-4 flex justify-center gap-6 text-sm">
              <div>
                <span className="text-gray-500">Mode Price:</span>
                <span className="text-white font-medium ml-2">${price_distribution?.mode_price}</span>
              </div>
              <div>
                <span className="text-gray-500">Median Price:</span>
                <span className="text-white font-medium ml-2">${price_distribution?.median_price}</span>
              </div>
            </div>
          </div>

          {/* Price by Size */}
          <div className="bg-white/5 rounded-xl p-4">
            <h4 className="text-white font-semibold mb-4">Price by Size</h4>
            <div className="h-48">
              <Bar data={getSizeData()} options={volumeOptions} />
            </div>
          </div>
        </div>
      )}

      {/* Technical Tab */}
      {activeTab === 'technical' && (
        <div className="space-y-6">
          {/* RSI Chart */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-semibold">RSI (Relative Strength Index)</h4>
              <div className="text-sm">
                <span className={`font-bold ${
                  (technical_indicators?.rsi?.slice(-1)[0] || 50) > 70 ? 'text-red-400' :
                  (technical_indicators?.rsi?.slice(-1)[0] || 50) < 30 ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {technical_indicators?.rsi?.slice(-1)[0]?.toFixed(1) || 'N/A'}
                </span>
                <span className="text-gray-500 ml-2">
                  {(technical_indicators?.rsi?.slice(-1)[0] || 50) > 70 ? '(Overbought)' :
                   (technical_indicators?.rsi?.slice(-1)[0] || 50) < 30 ? '(Oversold)' : '(Neutral)'}
                </span>
              </div>
            </div>
            <div className="h-48">
              <Line data={getRSIData()} options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: { ...chartOptions.scales.y, min: 0, max: 100, ticks: { color: 'rgba(255,255,255,0.6)' } }
                }
              }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span className="text-green-400">← Oversold (Buy Signal)</span>
              <span className="text-red-400">Overbought (Sell Signal) →</span>
            </div>
          </div>

          {/* Moving Averages */}
          <div className="bg-white/5 rounded-xl p-4">
            <h4 className="text-white font-semibold mb-4">Moving Averages</h4>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(technical_indicators?.moving_averages || {}).map(([key, values]) => {
                const lastValue = values[values.length - 1];
                const currentPrice = statistics?.current_price || 0;
                const isAbove = currentPrice > lastValue;
                return (
                  <div key={key} className="bg-white/5 rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-xs mb-1">{key.replace('ma_', '')} Day MA</p>
                    <p className="text-white font-bold">${lastValue}</p>
                    <p className={`text-xs mt-1 ${isAbove ? 'text-green-400' : 'text-red-400'}`}>
                      Price is {isAbove ? 'above' : 'below'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MACD */}
          <div className="bg-white/5 rounded-xl p-4">
            <h4 className="text-white font-semibold mb-4">MACD Analysis</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-gray-500 text-xs mb-1">MACD Line</p>
                <p className="text-white font-bold">
                  {technical_indicators?.macd?.macd?.slice(-1)[0]?.toFixed(2) || 'N/A'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-xs mb-1">Signal Line</p>
                <p className="text-indigo-400 font-bold">
                  {technical_indicators?.macd?.signal?.slice(-1)[0]?.toFixed(2) || 'N/A'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-xs mb-1">Histogram</p>
                <p className={`font-bold ${
                  (technical_indicators?.macd?.histogram?.slice(-1)[0] || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {technical_indicators?.macd?.histogram?.slice(-1)[0]?.toFixed(2) || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROI Tab */}
      {activeTab === 'roi' && (
        <div className="space-y-6">
          {/* ROI Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`rounded-xl p-4 text-center ${
              roi_metrics?.current_roi >= 0 
                ? 'bg-green-500/10 border border-green-500/30' 
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <p className="text-gray-400 text-xs mb-1">Current ROI</p>
              <p className={`text-3xl font-bold ${roi_metrics?.current_roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {roi_metrics?.current_roi >= 0 ? '+' : ''}{roi_metrics?.current_roi}%
              </p>
              <p className="text-xs text-gray-500 mt-1">vs Retail</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-1">Profit/Pair</p>
              <p className={`text-2xl font-bold ${roi_metrics?.profit_per_pair >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {roi_metrics?.profit_per_pair >= 0 ? '+' : ''}${roi_metrics?.profit_per_pair}
              </p>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-1">Best ROI</p>
              <p className="text-2xl font-bold text-green-400">+{roi_metrics?.best_possible_roi}%</p>
              <p className="text-xs text-gray-500 mt-1">+${roi_metrics?.max_profit_per_pair}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-1">Worst ROI</p>
              <p className="text-2xl font-bold text-red-400">{roi_metrics?.worst_possible_roi}%</p>
            </div>
          </div>

          {/* Annualized ROI */}
          <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl p-6 border border-indigo-500/30">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-2">Annualized ROI</p>
              <p className={`text-5xl font-bold ${roi_metrics?.annualized_roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {roi_metrics?.annualized_roi >= 0 ? '+' : ''}{roi_metrics?.annualized_roi}%
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Based on {roi_metrics?.days_tracked} days of price data
              </p>
            </div>
          </div>

          {/* Investment Calculator */}
          <div className="bg-white/5 rounded-xl p-4">
            <h4 className="text-white font-semibold mb-4">💰 Investment Summary</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-gray-400">Retail Price</span>
                <span className="text-white font-medium">${statistics?.retail_price}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-gray-400">Current Market Value</span>
                <span className="text-white font-medium">${statistics?.current_price}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-gray-400">Profit/Loss per Pair</span>
                <span className={`font-bold ${roi_metrics?.profit_per_pair >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {roi_metrics?.profit_per_pair >= 0 ? '+' : ''}${roi_metrics?.profit_per_pair}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">If you bought 10 pairs</span>
                <span className={`font-bold text-lg ${roi_metrics?.profit_per_pair >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {roi_metrics?.profit_per_pair >= 0 ? '+' : ''}${(roi_metrics?.profit_per_pair * 10).toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PriceAnalytics;


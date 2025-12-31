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
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function Compare() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSneakers, setSelectedSneakers] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [batchPredictions, setBatchPredictions] = useState(null);
  const [predictingBatch, setPredictingBatch] = useState(false);

  // Search sneakers
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await sneakerAPI.search(searchQuery);
      if (response.success && response.data) {
        setSearchResults(response.data.slice(0, 10));
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add sneaker to comparison
  const addToCompare = (sneaker) => {
    if (selectedSneakers.length >= 5) return;
    if (selectedSneakers.find(s => s.Name === sneaker.Name)) return;
    
    setSelectedSneakers([...selectedSneakers, sneaker]);
    setSearchResults([]);
    setSearchQuery('');
  };

  // Remove sneaker from comparison
  const removeFromCompare = (sneakerName) => {
    setSelectedSneakers(selectedSneakers.filter(s => s.Name !== sneakerName));
  };

  // Compare prices
  const comparePrices = async () => {
    if (selectedSneakers.length < 2) return;
    
    setComparing(true);
    try {
      const response = await sneakerAPI.comparePrices(
        selectedSneakers.map(s => s.Name)
      );
      if (response.success) {
        setComparisonData(response);
      }
    } catch (error) {
      console.error('Comparison error:', error);
    } finally {
      setComparing(false);
    }
  };

  // Batch predict prices
  const predictAllPrices = async () => {
    if (selectedSneakers.length < 1) return;
    
    setPredictingBatch(true);
    try {
      const sneakersData = selectedSneakers.map(s => ({
        sneaker_name: s.Name,
        brand: s.Brand,
        retail_price: s.RetailPrice || 150,
        release_date: s.ReleaseDate
      }));
      
      const response = await sneakerAPI.predictBestPriceBatch(sneakersData);
      if (response.success) {
        setBatchPredictions(response.predictions);
      }
    } catch (error) {
      console.error('Batch prediction error:', error);
    } finally {
      setPredictingBatch(false);
    }
  };

  // Chart data
  const chartData = comparisonData ? {
    labels: comparisonData.comparison?.map(c => c.sneaker?.slice(0, 20) + '...') || [],
    datasets: [
      {
        label: 'Average Price ($)',
        data: comparisonData.comparison?.map(c => c.avg_price || 0) || [],
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderRadius: 8,
      },
      {
        label: 'Min Price ($)',
        data: comparisonData.comparison?.map(c => c.min_price || 0) || [],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderRadius: 8,
      },
      {
        label: 'Max Price ($)',
        data: comparisonData.comparison?.map(c => c.max_price || 0) || [],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderRadius: 8,
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: 'white' }
      },
    },
    scales: {
      x: {
        ticks: { color: 'rgba(255,255,255,0.6)' },
        grid: { color: 'rgba(255,255,255,0.05)' }
      },
      y: {
        ticks: { color: 'rgba(255,255,255,0.6)' },
        grid: { color: 'rgba(255,255,255,0.05)' }
      }
    }
  };

  return (
    <Layout requireAuth>
      <div className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Compare Sneakers</h1>
            <p className="text-gray-400">Compare prices and predictions across multiple sneakers</p>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search sneakers to compare..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/10 rounded-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                    {searchResults.map((sneaker, idx) => (
                      <button
                        key={idx}
                        onClick={() => addToCompare(sneaker)}
                        className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                      >
                        <p className="text-white font-medium text-sm">{sneaker.Name}</p>
                        <p className="text-gray-500 text-xs">{sneaker.Brand} • ${sneaker.AvgSalePrice || sneaker.RetailPrice}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {/* Selected Sneakers */}
          {selectedSneakers.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Selected Sneakers ({selectedSneakers.length}/5)</h2>
                <div className="flex gap-3">
                  <button
                    onClick={comparePrices}
                    disabled={selectedSneakers.length < 2 || comparing}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {comparing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                        Comparing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Compare Prices
                      </>
                    )}
                  </button>
                  <button
                    onClick={predictAllPrices}
                    disabled={selectedSneakers.length < 1 || predictingBatch}
                    className="px-4 py-2 bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {predictingBatch ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                        Predicting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Predict All (AI)
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {selectedSneakers.map((sneaker, idx) => (
                  <div key={idx} className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 relative">
                    <button
                      onClick={() => removeFromCompare(sneaker.Name)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-full flex items-center justify-center transition-colors"
                    >
                      ×
                    </button>
                    <div className="w-full h-24 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg mb-3 flex items-center justify-center">
                      {sneaker.Image ? (
                        <img src={sneaker.Image} alt={sneaker.Name} className="w-full h-full object-contain p-2" />
                      ) : (
                        <span className="text-2xl">👟</span>
                      )}
                    </div>
                    <p className="text-white font-medium text-sm line-clamp-2 mb-1">{sneaker.Name}</p>
                    <p className="text-gray-500 text-xs">{sneaker.Brand}</p>
                    <p className="text-indigo-400 font-bold mt-2">${sneaker.AvgSalePrice || sneaker.RetailPrice}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparison Results */}
          {comparisonData && (
            <div className="mb-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Price Comparison</h2>
              
              <div className="h-80 mb-6">
                <Bar data={chartData} options={chartOptions} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {comparisonData.comparison?.map((item, idx) => (
                  <div key={idx} className="bg-white/5 rounded-xl p-4">
                    <p className="text-white font-medium text-sm line-clamp-1 mb-3">{item.sneaker}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-gray-500 text-xs">Min</p>
                        <p className="text-green-400 font-bold">${item.min_price?.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Avg</p>
                        <p className="text-indigo-400 font-bold">${item.avg_price?.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Max</p>
                        <p className="text-red-400 font-bold">${item.max_price?.toFixed(0)}</p>
                      </div>
                    </div>
                    <p className="text-gray-600 text-xs mt-2 text-center">{item.data_points} sales</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Batch Predictions */}
          {batchPredictions && (
            <div className="bg-gradient-to-br from-orange-600/10 to-pink-600/10 backdrop-blur-sm rounded-2xl border border-orange-500/30 p-6">
              <h2 className="text-xl font-semibold text-white mb-6">🔥 AI Price Predictions</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {batchPredictions.map((pred, idx) => (
                  <div key={idx} className="bg-white/5 rounded-xl p-4">
                    <p className="text-white font-medium text-sm line-clamp-1 mb-3">{pred.sneaker_name}</p>
                    {pred.error ? (
                      <p className="text-red-400 text-sm">{pred.error}</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-400 text-sm">Predicted Price</span>
                          <span className="text-white font-bold text-xl">${pred.best_predicted_price?.toFixed(0)}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-400 text-sm">Change</span>
                          <span className={`font-bold ${pred.price_change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pred.price_change_percent >= 0 ? '↑' : '↓'} {Math.abs(pred.price_change_percent).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm">Recommendation</span>
                          <span className={`text-sm font-medium px-2 py-1 rounded ${
                            pred.recommendation?.includes('BUY') ? 'bg-green-500/20 text-green-400' :
                            pred.recommendation?.includes('SELL') ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {pred.recommendation}
                          </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Confidence</span>
                            <span className="text-indigo-400">{(pred.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {selectedSneakers.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Start Comparing</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                Search for sneakers above and add up to 5 sneakers to compare their prices, market data, and AI predictions.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default Compare;

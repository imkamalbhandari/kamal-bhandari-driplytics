import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { sneakerAPI } from '../services/api';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [newAlert, setNewAlert] = useState({
    sneakerName: '',
    targetPrice: '',
    alertType: 'below', // 'below' or 'above'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trendingNow, setTrendingNow] = useState(null);
  const [redditHot, setRedditHot] = useState([]);

  // Load alerts from localStorage
  useEffect(() => {
    const savedAlerts = localStorage.getItem('priceAlerts');
    if (savedAlerts) {
      setAlerts(JSON.parse(savedAlerts));
    }
  }, []);

  // Save alerts to localStorage
  const saveAlerts = (newAlerts) => {
    localStorage.setItem('priceAlerts', JSON.stringify(newAlerts));
    setAlerts(newAlerts);
  };

  // Fetch trending data
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await sneakerAPI.getTrendingNow();
        if (response.success) {
          setTrendingNow(response.data);
        }
      } catch (error) {
        console.log('Trending not available');
      }
    };

    const fetchRedditHot = async () => {
      try {
        const response = await sneakerAPI.getRedditHot();
        if (response.success && response.data?.posts) {
          setRedditHot(response.data.posts.slice(0, 5));
        }
      } catch (error) {
        console.log('Reddit not available');
      }
    };

    fetchTrending();
    fetchRedditHot();
  }, []);

  // Search sneakers
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await sneakerAPI.search(searchQuery);
      if (response.success && response.data) {
        setSearchResults(response.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Select sneaker for alert
  const selectSneaker = (sneaker) => {
    setNewAlert({
      ...newAlert,
      sneakerName: sneaker.Name,
      currentPrice: sneaker.AvgSalePrice || sneaker.RetailPrice,
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  // Add new alert
  const addAlert = () => {
    if (!newAlert.sneakerName || !newAlert.targetPrice) return;
    
    const alert = {
      id: Date.now(),
      sneakerName: newAlert.sneakerName,
      targetPrice: parseFloat(newAlert.targetPrice),
      alertType: newAlert.alertType,
      currentPrice: newAlert.currentPrice || 0,
      createdAt: new Date().toISOString(),
      triggered: false,
    };
    
    saveAlerts([...alerts, alert]);
    setNewAlert({ sneakerName: '', targetPrice: '', alertType: 'below' });
  };

  // Remove alert
  const removeAlert = (alertId) => {
    saveAlerts(alerts.filter(a => a.id !== alertId));
  };

  // Toggle alert type
  const toggleAlertType = (alertId) => {
    saveAlerts(alerts.map(a => 
      a.id === alertId 
        ? { ...a, alertType: a.alertType === 'below' ? 'above' : 'below' }
        : a
    ));
  };

  return (
    <Layout requireAuth>
      <div className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Price Alerts</h1>
            <p className="text-gray-400">Get notified when sneaker prices hit your target</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Alert */}
            <div className="lg:col-span-2">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Create New Alert</h2>
                
                {/* Search */}
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Search Sneaker</label>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search for a sneaker..."
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/10 rounded-xl overflow-hidden z-50">
                          {searchResults.map((sneaker, idx) => (
                            <button
                              key={idx}
                              onClick={() => selectSneaker(sneaker)}
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
                      className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all disabled:opacity-50"
                    >
                      Search
                    </button>
                  </div>
                </div>

                {/* Selected Sneaker */}
                {newAlert.sneakerName && (
                  <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                    <p className="text-indigo-300 text-sm mb-1">Selected Sneaker:</p>
                    <p className="text-white font-medium">{newAlert.sneakerName}</p>
                    {newAlert.currentPrice > 0 && (
                      <p className="text-gray-400 text-sm">Current Price: ${newAlert.currentPrice}</p>
                    )}
                  </div>
                )}

                {/* Target Price & Type */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Target Price ($)</label>
                    <input
                      type="number"
                      value={newAlert.targetPrice}
                      onChange={(e) => setNewAlert({ ...newAlert, targetPrice: e.target.value })}
                      placeholder="e.g., 200"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Alert When Price</label>
                    <select
                      value={newAlert.alertType}
                      onChange={(e) => setNewAlert({ ...newAlert, alertType: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="below" className="bg-gray-900">Falls Below</option>
                      <option value="above" className="bg-gray-900">Goes Above</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={addAlert}
                  disabled={!newAlert.sneakerName || !newAlert.targetPrice}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl transition-all disabled:opacity-50"
                >
                  Create Alert
                </button>
              </div>

              {/* Active Alerts */}
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Active Alerts ({alerts.length})</h2>
                
                {alerts.length > 0 ? (
                  <div className="space-y-4">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-white font-medium line-clamp-1">{alert.sneakerName}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                alert.alertType === 'below' 
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-orange-500/20 text-orange-400'
                              }`}>
                                {alert.alertType === 'below' ? '↓ Below' : '↑ Above'} ${alert.targetPrice}
                              </span>
                              {alert.currentPrice > 0 && (
                                <span className="text-gray-500 text-xs">
                                  Current: ${alert.currentPrice}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-gray-600 text-xs mt-2">
                          Created: {new Date(alert.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <p className="text-gray-400">No alerts yet</p>
                    <p className="text-gray-600 text-sm">Create an alert to get notified of price changes</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Trending & Hot */}
            <div className="space-y-6">
              {/* Trending Now */}
              {trendingNow && (
                <div className="bg-gradient-to-br from-orange-600/10 to-red-600/10 backdrop-blur-sm rounded-2xl border border-orange-500/30 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🔥</span>
                    <h3 className="text-white font-semibold">Trending Now</h3>
                  </div>
                  <div className="space-y-3">
                    {trendingNow.trending_sneakers?.slice(0, 5).map((sneaker, idx) => (
                      <div key={idx} className="p-3 bg-white/5 rounded-lg">
                        <p className="text-white text-sm font-medium line-clamp-1">{sneaker.name || sneaker}</p>
                        {sneaker.hype_score && (
                          <p className="text-orange-400 text-xs">Hype: {sneaker.hype_score}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reddit Hot */}
              {redditHot.length > 0 && (
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0z"/>
                    </svg>
                    <h3 className="text-white font-semibold">Reddit Hot</h3>
                  </div>
                  <div className="space-y-3">
                    {redditHot.map((post, idx) => (
                      <a
                        key={idx}
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <p className="text-white text-sm line-clamp-2">{post.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className="text-orange-400">↑{post.score}</span>
                          <span className="text-gray-500">r/{post.subreddit}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Tips */}
              <div className="bg-indigo-500/10 backdrop-blur-sm rounded-2xl border border-indigo-500/30 p-6">
                <h3 className="text-white font-semibold mb-3">💡 Quick Tips</h3>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li>• Set alerts for sneakers you're watching</li>
                  <li>• Use "Below" alerts for buying opportunities</li>
                  <li>• Use "Above" alerts for selling signals</li>
                  <li>• Check Reddit for community sentiment</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Alerts;

import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { sneakerAPI, alertsAPI } from '../services/api';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [newAlert, setNewAlert] = useState({
    sneakerName: '',
    brand: '',
    retailPrice: 0,
    currentPrice: 0,
    targetPrice: '',
    alertType: 'below',
    phoneNumber: '',
    notifyEmail: true,
    notifyPhone: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [trendingNow, setTrendingNow] = useState(null);
  const [redditHot, setRedditHot] = useState([]);

  // Load alerts from backend
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await alertsAPI.getAll();
      if (response.success) {
        setAlerts(response.alerts);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Fetch trending data
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await sneakerAPI.getTrendingNow();
        if (response.success) {
          setTrendingNow(response.data);
        }
      } catch {
        // Trending not available
      }
    };

    const fetchRedditHot = async () => {
      try {
        const response = await sneakerAPI.getRedditHot();
        if (response.success && response.data?.posts) {
          setRedditHot(response.data.posts.slice(0, 5));
        }
      } catch {
        // Reddit not available
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
      brand: sneaker.Brand || '',
      retailPrice: sneaker.RetailPrice || 0,
      currentPrice: sneaker.AvgSalePrice || sneaker.RetailPrice || 0,
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  // Create new alert
  const handleCreateAlert = async () => {
    if (!newAlert.sneakerName || !newAlert.targetPrice) {
      setMessage({ type: 'error', text: 'Please select a sneaker and set a target price' });
      return;
    }

    if (newAlert.notifyPhone && !newAlert.phoneNumber) {
      setMessage({ type: 'error', text: 'Please enter a phone number for SMS alerts' });
      return;
    }

    setCreating(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await alertsAPI.create({
        sneakerName: newAlert.sneakerName,
        brand: newAlert.brand,
        retailPrice: newAlert.retailPrice,
        currentPrice: newAlert.currentPrice,
        targetPrice: parseFloat(newAlert.targetPrice),
        alertType: newAlert.alertType,
        phoneNumber: newAlert.phoneNumber || null,
        notifyEmail: newAlert.notifyEmail,
        notifyPhone: newAlert.notifyPhone,
      });

      if (response.success) {
        setMessage({ type: 'success', text: 'Alert created successfully!' });
        setNewAlert({
          sneakerName: '',
          brand: '',
          retailPrice: 0,
          currentPrice: 0,
          targetPrice: '',
          alertType: 'below',
          phoneNumber: newAlert.phoneNumber, // Keep phone number for convenience
          notifyEmail: true,
          notifyPhone: newAlert.notifyPhone,
        });
        fetchAlerts();
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to create alert';
      setMessage({ type: 'error', text: msg });
    } finally {
      setCreating(false);
    }
  };

  // Delete alert
  const handleDeleteAlert = async (alertId) => {
    try {
      await alertsAPI.delete(alertId);
      setAlerts(alerts.filter(a => a._id !== alertId));
    } catch (error) {
      console.error('Delete alert error:', error);
    }
  };

  // Toggle alert on/off
  const handleToggleAlert = async (alertId) => {
    try {
      const response = await alertsAPI.toggle(alertId);
      if (response.success) {
        setAlerts(alerts.map(a => a._id === alertId ? response.alert : a));
      }
    } catch (error) {
      console.error('Toggle alert error:', error);
    }
  };

  // Manually check all alerts for fresh predicted prices
  const handleCheckAlerts = async () => {
    setChecking(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await alertsAPI.check();
      if (response.success) {
        setMessage({
          type: 'success',
          text: `Checked ${response.checked} alert(s). ${response.triggered} triggered!`
        });
        fetchAlerts(); // Refresh to get updated predicted prices
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to check alerts. Make sure the ML service is running.' });
    } finally {
      setChecking(false);
    }
  };

  // Auto-clear message after 5s
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const activeAlerts = alerts.filter(a => a.enabled && !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);
  const disabledAlerts = alerts.filter(a => !a.enabled && !a.triggered);

  return (
    <Layout requireAuth>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Price Alerts</h1>
            <p className="text-gray-400">Get notified via email when predicted prices hit your target</p>
          </div>
          <button
            onClick={handleCheckAlerts}
            disabled={checking || activeAlerts.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all disabled:opacity-50"
          >
            {checking ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Check Prices Now
              </>
            )}
          </button>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
              : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}>
            {message.type === 'success' ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Alert + Active Alerts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Create Alert */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
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
                      <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/10 rounded-xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                        {searchResults.map((sneaker, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectSneaker(sneaker)}
                            className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                          >
                            <p className="text-white font-medium text-sm">{sneaker.Name}</p>
                            <p className="text-gray-500 text-xs">{sneaker.Brand} • Avg: ${sneaker.AvgSalePrice || sneaker.RetailPrice}</p>
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
                    {loading ? '...' : 'Search'}
                  </button>
                </div>
              </div>

              {/* Selected Sneaker */}
              {newAlert.sneakerName && (
                <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-indigo-300 text-sm mb-1">Selected Sneaker:</p>
                      <p className="text-white font-medium">{newAlert.sneakerName}</p>
                      <p className="text-gray-400 text-sm">{newAlert.brand} • Avg Price: ${newAlert.currentPrice}</p>
                    </div>
                    <button
                      onClick={() => setNewAlert({ ...newAlert, sneakerName: '', brand: '', retailPrice: 0, currentPrice: 0 })}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
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

              {/* Notification Settings */}
              <div className="mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-white font-medium text-sm mb-3">Notification Method</p>
                
                {/* Email toggle */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-300 text-sm">Email Notification</span>
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded font-medium">Active</span>
                  </div>
                  <button
                    onClick={() => setNewAlert({ ...newAlert, notifyEmail: !newAlert.notifyEmail })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      newAlert.notifyEmail ? 'bg-indigo-600' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      newAlert.notifyEmail ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                </div>

                {/* Phone alert toggle */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-300 text-sm">Phone Alert</span>
                  </div>
                  <button
                    onClick={() => setNewAlert({ ...newAlert, notifyPhone: !newAlert.notifyPhone })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      newAlert.notifyPhone ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      newAlert.notifyPhone ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                </div>

                {/* Phone number input */}
                {newAlert.notifyPhone && (
                  <div className="mt-3">
                    <label className="block text-gray-400 text-xs mb-1.5">Phone Number (with country code)</label>
                    <input
                      type="tel"
                      value={newAlert.phoneNumber}
                      onChange={(e) => setNewAlert({ ...newAlert, phoneNumber: e.target.value })}
                      placeholder="+977 98XXXXXXXX"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    />
                    <p className="text-gray-500 text-xs mt-1.5">Your phone number will be included in the alert email notification</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateAlert}
                disabled={!newAlert.sneakerName || !newAlert.targetPrice || creating}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Create Alert
                  </>
                )}
              </button>
            </div>

            {/* Active Alerts */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  Active Alerts ({activeAlerts.length})
                </h2>
                <span className="text-xs text-gray-500">Auto-checked every 2 hours</span>
              </div>
              
              {alertsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="animate-pulse p-4 bg-white/5 rounded-xl">
                      <div className="h-4 bg-white/10 rounded w-3/4 mb-3"></div>
                      <div className="h-3 bg-white/10 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : activeAlerts.length > 0 ? (
                <div className="space-y-4">
                  {activeAlerts.map((alert) => (
                    <AlertCard
                      key={alert._id}
                      alert={alert}
                      onDelete={handleDeleteAlert}
                      onToggle={handleToggleAlert}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="text-gray-400">No active alerts</p>
                  <p className="text-gray-600 text-sm">Create an alert to get notified of price changes</p>
                </div>
              )}
            </div>

            {/* Triggered Alerts */}
            {triggeredAlerts.length > 0 && (
              <div className="bg-green-500/5 backdrop-blur-sm rounded-2xl border border-green-500/20 p-6">
                <h2 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Triggered Alerts ({triggeredAlerts.length})
                </h2>
                <div className="space-y-4">
                  {triggeredAlerts.map((alert) => (
                    <AlertCard
                      key={alert._id}
                      alert={alert}
                      onDelete={handleDeleteAlert}
                      onToggle={handleToggleAlert}
                      isTriggered
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Disabled Alerts */}
            {disabledAlerts.length > 0 && (
              <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-gray-500 mb-4">
                  Disabled Alerts ({disabledAlerts.length})
                </h2>
                <div className="space-y-4">
                  {disabledAlerts.map((alert) => (
                    <AlertCard
                      key={alert._id}
                      alert={alert}
                      onDelete={handleDeleteAlert}
                      onToggle={handleToggleAlert}
                      isDisabled
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* How It Works */}
            <div className="bg-gradient-to-br from-indigo-600/10 to-purple-600/10 backdrop-blur-sm rounded-2xl border border-indigo-500/30 p-6">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How It Works
              </h3>
              <ol className="space-y-3 text-gray-400 text-sm">
                <li className="flex gap-2">
                  <span className="text-indigo-400 font-bold">1.</span>
                  <span>Search and select a sneaker to watch</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400 font-bold">2.</span>
                  <span>Set your target price and condition</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400 font-bold">3.</span>
                  <span>Add your phone number for SMS alerts</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400 font-bold">4.</span>
                  <span>We check predicted prices every 2 hours using AI models</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400 font-bold">5.</span>
                  <span>Get notified via email & SMS when your target is hit!</span>
                </li>
              </ol>
            </div>

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
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ==================== Alert Card Component ====================
function AlertCard({ alert, onDelete, onToggle, isTriggered = false, isDisabled = false }) {
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isTriggered
        ? 'bg-green-500/10 border-green-500/30'
        : isDisabled
          ? 'bg-white/[0.03] border-white/5 opacity-60'
          : 'bg-white/5 border-white/10'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium line-clamp-1">{alert.sneakerName}</p>
          
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Alert type badge */}
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              alert.alertType === 'below' 
                ? 'bg-green-500/20 text-green-400'
                : 'bg-orange-500/20 text-orange-400'
            }`}>
              {alert.alertType === 'below' ? '↓ Below' : '↑ Above'} ${alert.targetPrice}
            </span>

            {/* Current avg price */}
            {alert.currentPrice > 0 && (
              <span className="text-gray-500 text-xs">
                Avg: ${alert.currentPrice}
              </span>
            )}

            {/* Predicted price - DYNAMIC */}
            {alert.predictedPrice > 0 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                isTriggered ? 'bg-green-500/20 text-green-400' : 'bg-indigo-500/20 text-indigo-400'
              }`}>
                Predicted: ${alert.predictedPrice.toFixed(2)}
              </span>
            )}
          </div>

          {/* Notification info */}
          <div className="flex items-center gap-3 mt-2">
            {alert.notifyEmail && (
              <span className={`text-xs flex items-center gap-1 ${
                isTriggered && alert.emailStatus === 'sent' ? 'text-green-400' :
                isTriggered && alert.emailStatus === 'failed' ? 'text-red-400' :
                'text-gray-500'
              }`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email {isTriggered && alert.emailStatus === 'sent' && '✓'}
                {isTriggered && alert.emailStatus === 'failed' && '✗'}
              </span>
            )}
            {alert.notifyPhone && alert.phoneNumber && (
              <span className={`text-xs flex items-center gap-1 ${
                isTriggered && alert.smsStatus === 'sent' ? 'text-green-400' :
                isTriggered && alert.smsStatus === 'failed' ? 'text-red-400' :
                'text-gray-500'
              }`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                SMS {alert.phoneNumber} {isTriggered && alert.smsStatus === 'sent' && '✓'}
                {isTriggered && alert.smsStatus === 'failed' && '✗'}
              </span>
            )}
          </div>

          {/* Timestamp info */}
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <p className="text-gray-600 text-xs">
              Created: {formatDate(alert.createdAt)}
            </p>
            {alert.lastChecked && (
              <p className="text-gray-600 text-xs">
                Last checked: {formatDate(alert.lastChecked)}
              </p>
            )}
            {isTriggered && alert.triggeredAt && (
              <p className="text-green-500 text-xs font-medium">
                Triggered: {formatDate(alert.triggeredAt)}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Toggle enable/disable */}
          <button
            onClick={() => onToggle(alert._id)}
            className={`p-2 rounded-lg transition-colors ${
              isTriggered
                ? 'text-green-400 hover:bg-green-500/20'
                : isDisabled
                  ? 'text-gray-500 hover:bg-white/10'
                  : 'text-indigo-400 hover:bg-indigo-500/20'
            }`}
            title={isTriggered ? 'Re-enable alert' : alert.enabled ? 'Disable alert' : 'Enable alert'}
          >
            {alert.enabled && !isTriggered ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(alert._id)}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete alert"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Alerts;

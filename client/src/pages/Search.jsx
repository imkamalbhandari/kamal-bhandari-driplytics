import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api, { sneakerAPI, authAPI } from '../services/api';

function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState('grid');
  const [sneakers, setSneakers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [brands, setBrands] = useState([{ id: 'all', name: 'All Brands' }]);
  const [mlServiceStatus, setMlServiceStatus] = useState('checking');
  const [aiSearchEnabled, setAiSearchEnabled] = useState(true); // AI smart search toggle
  const [aiSummary, setAiSummary] = useState(null); // AI-generated search summary
  const [aiParsed, setAiParsed] = useState(null); // AI-parsed query info

  const priceRanges = [
    { id: 'all', name: 'All Prices' },
    { id: '0-100', name: 'Under $100' },
    { id: '100-200', name: '$100 - $200' },
    { id: '200-500', name: '$200 - $500' },
    { id: '500+', name: '$500+' },
  ];

  // Check ML service health
  useEffect(() => {
    const checkMlHealth = async () => {
      try {
        await api.get('/sneakers/ml-health');
        setMlServiceStatus('connected');
      } catch {
        setMlServiceStatus('disconnected');
      }
    };
    checkMlHealth();
  }, []);

  // Fetch brands from API
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await api.get('/sneakers/brands');
        if (response.data.success && response.data.brands) {
          const brandOptions = [
            { id: 'all', name: 'All Brands' },
            ...response.data.brands.map(b => ({ id: b.toLowerCase(), name: b }))
          ];
          setBrands(brandOptions);
        }
      } catch (err) {
        console.log('Using default brands');
      }
    };
    fetchBrands();
  }, []);

  // Search sneakers
  const searchSneakers = useCallback(async () => {
    if (!searchQuery.trim() && selectedBrand === 'all') {
      setSneakers([]);
      setAiSummary(null);
      setAiParsed(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    setAiSummary(null);
    setAiParsed(null);
    
    try {
      let allResults = [];
      
      // Try AI Smart Search first if enabled
      if (aiSearchEnabled && searchQuery.trim()) {
        try {
          const smartResponse = await sneakerAPI.smartSearch(searchQuery);
          
          if (smartResponse.success) {
            setAiParsed(smartResponse.parsed);
            setAiSummary(smartResponse.summary);
            
            // Use AI-filtered results if available
            if (smartResponse.results && smartResponse.results.length > 0) {
              const aiResults = smartResponse.results.map((sneaker, index) => ({
                id: sneaker.ID || `ai-${index}`,
                name: sneaker.Name || 'Unknown Sneaker',
                brand: sneaker.Brand || 'Unknown',
                colorway: sneaker.Colorway || '',
                retailPrice: sneaker.RetailPrice || 0,
                resalePrice: Math.round((sneaker.RetailPrice || 100) * 1.2),
                priceChange: '+0%',
                releaseDate: sneaker.ReleaseDate || '',
                volatility: sneaker.Volatility || 0,
                gender: sneaker.Gender || 'unisex',
                image: null,
                styleCode: sneaker.StyleID || '',
                source: 'ai_search'
              }));
              allResults = [...allResults, ...aiResults];
            }
          }
        } catch (aiErr) {
          console.log('AI search failed, falling back to standard search:', aiErr.message);
        }
      }
      
      // If AI search didn't return results, fall back to dataset search
      if (allResults.length === 0) {
        try {
          const params = {};
          if (searchQuery) params.name = searchQuery;
          if (selectedBrand !== 'all') params.brand = selectedBrand;
          
          const response = await api.get('/sneakers/search', { params });
          
          if (response.data.success && response.data.data) {
            const datasetResults = response.data.data.map((sneaker, index) => ({
              id: sneaker.Name || `ds-${index}`,
              name: sneaker.Name || 'Unknown Sneaker',
              brand: sneaker.Brand || 'Unknown',
              colorway: '',
              retailPrice: sneaker.RetailPrice || 0,
              resalePrice: sneaker.AvgSalePrice || Math.round((sneaker.RetailPrice || 100) * (1 + (sneaker.ChangePercent || 0))),
              priceChange: sneaker.ChangePercent 
                ? `${sneaker.ChangePercent >= 0 ? '+' : ''}${(sneaker.ChangePercent * 100).toFixed(1)}%`
                : '0%',
              releaseDate: sneaker.ReleaseDate || '',
              volatility: 0.15,
              gender: 'unisex',
              image: sneaker.Image || null,
              styleCode: '',
              source: 'dataset',
              saleCount: sneaker.SaleCount || 0,
              minPrice: sneaker.MinPrice || 0,
              maxPrice: sneaker.MaxPrice || 0
            }));
            allResults = [...allResults, ...datasetResults];
          }
        } catch (datasetErr) {
          console.log('Dataset search failed:', datasetErr.message);
        }
      }
      
      setSneakers(allResults);
      
      // Track search history (if logged in)
      if (searchQuery.trim() && allResults.length > 0) {
        try {
          await authAPI.addSearchHistory(searchQuery, allResults.length);
        } catch (e) {
          // Silently fail - user might not be logged in
        }
      }
      
      if (allResults.length === 0) {
        setError('No sneakers found. Try a different search term.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search sneakers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedBrand, aiSearchEnabled]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mlServiceStatus === 'connected') {
        searchSneakers();
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery, selectedBrand, mlServiceStatus, searchSneakers]);

  // Filter and sort sneakers
  const filteredSneakers = sneakers.filter((sneaker) => {
    let matchesPrice = true;
    const price = sneaker.resalePrice || sneaker.retailPrice;
    if (priceRange === '0-100') matchesPrice = price < 100;
    else if (priceRange === '100-200') matchesPrice = price >= 100 && price < 200;
    else if (priceRange === '200-500') matchesPrice = price >= 200 && price < 500;
    else if (priceRange === '500+') matchesPrice = price >= 500;
    
    return matchesPrice;
  }).sort((a, b) => {
    if (sortBy === 'price-low') return (a.resalePrice || a.retailPrice) - (b.resalePrice || b.retailPrice);
    if (sortBy === 'price-high') return (b.resalePrice || b.retailPrice) - (a.resalePrice || a.retailPrice);
    if (sortBy === 'newest') return new Date(b.releaseDate) - new Date(a.releaseDate);
    return 0; // popular - keep original order
  });

  return (
    <Layout requireAuth>
      <div className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Search Sneakers</h1>
              <p className="text-gray-400">Find and analyze any sneaker in the market</p>
            </div>
            {/* ML Service Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              mlServiceStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400' 
                : mlServiceStatus === 'checking'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                mlServiceStatus === 'connected' ? 'bg-green-400' : 
                mlServiceStatus === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
              }`} />
              {mlServiceStatus === 'connected' ? 'AI Connected' : 
               mlServiceStatus === 'checking' ? 'Checking...' : 'AI Offline'}
            </div>
          </div>
          {mlServiceStatus === 'disconnected' && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm">
                ⚠️ ML Service is not running. Start it with: <code className="bg-black/30 px-2 py-1 rounded">cd ml_service && python app.py</code>
              </p>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {aiSearchEnabled ? (
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={aiSearchEnabled ? "Try: 'Jordans under $200' or 'trending Nike dunks'" : "Search by name, brand, or colorway..."}
            className={`w-full pl-12 pr-4 py-4 bg-white/5 border rounded-2xl text-white placeholder-gray-400 focus:ring-2 focus:border-transparent outline-none transition-all ${
              aiSearchEnabled ? 'border-purple-500/30 focus:ring-purple-500' : 'border-white/10 focus:ring-indigo-500'
            }`}
          />
        </div>

        {/* AI Search Toggle */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setAiSearchEnabled(!aiSearchEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              aiSearchEnabled 
                ? 'bg-purple-600/20 border border-purple-500/30 text-purple-400' 
                : 'bg-white/5 border border-white/10 text-gray-400'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Smart Search {aiSearchEnabled ? 'ON' : 'OFF'}
          </button>
          {aiSearchEnabled && (
            <p className="text-gray-500 text-sm">Powered by Groq LLM - understand natural language queries</p>
          )}
        </div>

        {/* AI Summary & Parsed Info */}
        {aiSummary && (
          <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-purple-300 font-medium mb-1">AI Summary</p>
                <p className="text-gray-300 text-sm">{aiSummary}</p>
                {aiParsed && aiParsed.intent && (
                  <p className="text-gray-500 text-xs mt-2">
                    Understood: {aiParsed.intent}
                    {aiParsed.brand && ` • Brand: ${aiParsed.brand}`}
                    {aiParsed.max_price && ` • Max: $${aiParsed.max_price}`}
                    {aiParsed.trend && ` • Trend: ${aiParsed.trend}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          {/* Brand Filter */}
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none cursor-pointer"
          >
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id} className="bg-gray-900">
                {brand.name}
              </option>
            ))}
          </select>

          {/* Price Filter */}
          <select
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none cursor-pointer"
          >
            {priceRanges.map((range) => (
              <option key={range.id} value={range.id} className="bg-gray-900">
                {range.name}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none cursor-pointer"
          >
            <option value="popular" className="bg-gray-900">Most Popular</option>
            <option value="price-low" className="bg-gray-900">Price: Low to High</option>
            <option value="price-high" className="bg-gray-900">Price: High to Low</option>
            <option value="newest" className="bg-gray-900">Newest First</option>
          </select>

          {/* View Toggle */}
          <div className="flex gap-1 ml-auto bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-gray-400 text-sm mb-6">
          {loading ? 'Searching...' : `Showing ${filteredSneakers.length} results`}
        </p>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        )}

        {/* Sneaker Grid */}
        {!loading && viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSneakers.map((sneaker) => (
              <Link
                key={sneaker.id}
                to={sneaker.source === 'ebay' && sneaker.itemUrl ? sneaker.itemUrl : `/sneaker/${encodeURIComponent(sneaker.name)}`}
                target={sneaker.source === 'ebay' && sneaker.itemUrl ? '_blank' : undefined}
                rel={sneaker.source === 'ebay' && sneaker.itemUrl ? 'noopener noreferrer' : undefined}
                state={sneaker.source !== 'ebay' ? { sneaker: {
                  id: sneaker.name,
                  name: sneaker.name,
                  brand: sneaker.brand,
                  colorway: sneaker.colorway,
                  styleCode: sneaker.styleCode || '',
                  releaseDate: sneaker.releaseDate,
                  retailPrice: sneaker.retailPrice || sneaker.resalePrice,
                  description: `${sneaker.name} - A premium sneaker from ${sneaker.brand}.`,
                  sizes: ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13'],
                  priceBySize: {
                    '7': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.05),
                    '7.5': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.03),
                    '8': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.02),
                    '8.5': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.01),
                    '9': Math.round(sneaker.resalePrice || sneaker.retailPrice),
                    '9.5': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 0.99),
                    '10': Math.round(sneaker.resalePrice || sneaker.retailPrice),
                    '10.5': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.01),
                    '11': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.02),
                    '11.5': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.01),
                    '12': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 0.98),
                    '13': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 0.95)
                  },
                  volatility: sneaker.volatility || 0.15,
                  gender: sneaker.gender || 'men',
                  image: sneaker.image || null,
                }} : undefined}
                className="group bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:border-indigo-500/50 transition-all hover:transform hover:scale-[1.02]"
              >
                {/* Image */}
                <div className="relative aspect-square bg-gradient-to-br from-gray-800 to-gray-900 p-6">
                  <div className="absolute top-4 left-4 z-10">
                    {sneaker.source === 'ebay' && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-lg">
                        eBay
                      </span>
                    )}
                  </div>
                  <div className="absolute top-4 right-4 z-10">
                    <button 
                      onClick={(e) => { e.preventDefault(); }}
                      className="p-2 bg-black/50 rounded-full text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                  <div className="w-full h-full flex items-center justify-center">
                    {sneaker.image ? (
                      <img 
                        src={sneaker.image} 
                        alt={sneaker.name}
                        className="w-full h-full object-contain"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div className={`w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center ${sneaker.image ? 'hidden' : ''}`}>
                      <svg className="w-16 h-16 text-indigo-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs font-medium rounded-lg">
                      {sneaker.brand}
                    </span>
                    {sneaker.condition && (
                      <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs font-medium rounded-lg">
                        {sneaker.condition}
                      </span>
                    )}
                    {sneaker.priceChange !== '+0%' && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-lg ${
                        sneaker.priceChange.startsWith('+') 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {sneaker.priceChange}
                      </span>
                    )}
                  </div>
                  <h3 className="text-white font-semibold mb-1 group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {sneaker.name}
                  </h3>
                  <p className="text-gray-400 text-sm mb-3">{sneaker.colorway || (sneaker.seller ? `Seller: ${sneaker.seller}` : '')}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs">{sneaker.source === 'ebay' ? 'eBay Price' : 'Resale Price'}</p>
                      <p className="text-white font-bold text-lg">${sneaker.resalePrice || sneaker.retailPrice}</p>
                    </div>
                    {sneaker.retailPrice > 0 && sneaker.source !== 'ebay' && (
                      <div className="text-right">
                        <p className="text-gray-500 text-xs">Retail</p>
                        <p className="text-gray-400">${sneaker.retailPrice}</p>
                      </div>
                    )}
                    {sneaker.sellerRating && (
                      <div className="text-right">
                        <p className="text-gray-500 text-xs">Seller Rating</p>
                        <p className="text-green-400">{sneaker.sellerRating}%</p>
                      </div>
                    )}
                  </div>
                  {/* Predict Price Button */}
                  {sneaker.source !== 'ebay' && (
                    <div className="mt-4 pt-3 border-t border-white/10">
                      <span className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-indigo-600/50 to-purple-600/50 hover:from-indigo-600 hover:to-purple-600 text-white text-sm font-medium rounded-lg transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Click to Predict Price
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : !loading && (
          <div className="space-y-4">
            {filteredSneakers.map((sneaker) => (
              <Link
                key={sneaker.id}
                to={sneaker.source === 'ebay' && sneaker.itemUrl ? sneaker.itemUrl : `/sneaker/${encodeURIComponent(sneaker.name)}`}
                target={sneaker.source === 'ebay' && sneaker.itemUrl ? '_blank' : undefined}
                rel={sneaker.source === 'ebay' && sneaker.itemUrl ? 'noopener noreferrer' : undefined}
                state={sneaker.source !== 'ebay' ? { sneaker: {
                  id: sneaker.name,
                  name: sneaker.name,
                  brand: sneaker.brand,
                  colorway: sneaker.colorway,
                  styleCode: sneaker.styleCode || '',
                  releaseDate: sneaker.releaseDate,
                  retailPrice: sneaker.retailPrice || sneaker.resalePrice,
                  description: `${sneaker.name} - A premium sneaker from ${sneaker.brand}.`,
                  sizes: ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13'],
                  priceBySize: {
                    '7': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.05),
                    '7.5': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.03),
                    '8': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.02),
                    '8.5': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.01),
                    '9': Math.round(sneaker.resalePrice || sneaker.retailPrice),
                    '9.5': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 0.99),
                    '10': Math.round(sneaker.resalePrice || sneaker.retailPrice),
                    '10.5': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.01),
                    '11': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.02),
                    '11.5': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 1.01),
                    '12': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 0.98),
                    '13': Math.round((sneaker.resalePrice || sneaker.retailPrice) * 0.95)
                  },
                  volatility: sneaker.volatility || 0.15,
                  gender: sneaker.gender || 'men',
                  image: sneaker.image || null,
                }} : undefined}
                className="flex items-center gap-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 hover:border-indigo-500/50 transition-all"
              >
                {/* Source Badge */}
                {sneaker.source === 'ebay' && (
                  <span className="absolute top-2 left-2 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-lg">
                    eBay
                  </span>
                )}
                
                {/* Image */}
                <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                  {sneaker.image ? (
                    <img 
                      src={sneaker.image} 
                      alt={sneaker.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-indigo-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs font-medium rounded-lg">
                      {sneaker.brand}
                    </span>
                    {sneaker.source === 'ebay' && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-lg">
                        eBay
                      </span>
                    )}
                  </div>
                  <h3 className="text-white font-semibold truncate">{sneaker.name}</h3>
                  <p className="text-gray-400 text-sm">{sneaker.colorway || (sneaker.seller ? `Seller: ${sneaker.seller}` : '')}</p>
                </div>

                {/* Price */}
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-bold text-xl">${sneaker.resalePrice}</p>
                  <p className={`text-sm font-medium ${
                    sneaker.priceChange.startsWith('+') ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {sneaker.priceChange}
                  </p>
                </div>

                {/* Action */}
                <button 
                  onClick={(e) => { e.preventDefault(); }}
                  className="p-3 bg-white/5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-white/10 transition-all flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredSneakers.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold mb-2">No sneakers found</h3>
            <p className="text-gray-400">Try adjusting your search or filters</p>
          </div>
        )}
        </div>
      </div>
    </Layout>
  );
}

export default Search;

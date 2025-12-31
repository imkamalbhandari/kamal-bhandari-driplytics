import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { favoritesAPI } from '../services/api';

function Favorites() {
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('recent');
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const response = await favoritesAPI.getAll();
      if (response.success) {
        setFavorites(response.data);
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
      setError('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (e, id) => {
    e.preventDefault();
    try {
      const response = await favoritesAPI.remove(id);
      if (response.success) {
        setFavorites(favorites.filter(f => f.id !== id));
      }
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  // Sort favorites based on sortBy
  const sortedFavorites = [...favorites].sort((a, b) => {
    switch (sortBy) {
      case 'price-high':
        return b.currentPrice - a.currentPrice;
      case 'price-low':
        return a.currentPrice - b.currentPrice;
      case 'change':
        return Math.abs(parseFloat(b.priceChange)) - Math.abs(parseFloat(a.priceChange));
      case 'recent':
      default:
        return new Date(b.addedDate) - new Date(a.addedDate);
    }
  });

  const totalValue = sortedFavorites.reduce((sum, item) => sum + item.currentPrice, 0);
  const totalSavedValue = sortedFavorites.reduce((sum, item) => sum + item.savedPrice, 0);
  const overallChange = totalSavedValue > 0 ? ((totalValue - totalSavedValue) / totalSavedValue * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <Layout requireAuth>
        <div className="w-full min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth>
      <div className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Your Favorites</h1>
            <p className="text-gray-400">Track and monitor your saved sneakers</p>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Sneakers
          </Link>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <p className="text-gray-400 text-sm mb-1">Total Items</p>
            <p className="text-3xl font-bold text-white">{sortedFavorites.length}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <p className="text-gray-400 text-sm mb-1">Total Value</p>
            <p className="text-3xl font-bold text-white">${totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <p className="text-gray-400 text-sm mb-1">Overall Change</p>
            <p className={`text-3xl font-bold ${parseFloat(overallChange) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {parseFloat(overallChange) >= 0 ? '+' : ''}{overallChange}%
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none cursor-pointer"
          >
            <option value="recent" className="bg-gray-900">Recently Added</option>
            <option value="price-high" className="bg-gray-900">Price: High to Low</option>
            <option value="price-low" className="bg-gray-900">Price: Low to High</option>
            <option value="change" className="bg-gray-900">Biggest Change</option>
          </select>

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

        {/* Favorites Grid/List */}
        {sortedFavorites.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedFavorites.map((sneaker) => (
                <Link
                  key={sneaker.id}
                  to={`/sneaker/${sneaker.sneakerId}`}
                  state={{ sneaker: {
                    id: sneaker.sneakerId,
                    name: sneaker.name,
                    brand: sneaker.brand,
                    colorway: sneaker.colorway,
                    styleCode: sneaker.styleCode,
                    releaseDate: sneaker.releaseDate,
                    retailPrice: sneaker.retailPrice,
                    gender: sneaker.gender,
                    volatility: sneaker.volatility
                  }}}
                  className="group bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:border-indigo-500/50 transition-all"
                >
                  {/* Image */}
                  <div className="relative aspect-square bg-gradient-to-br from-gray-800 to-gray-900 p-6">
                    <button 
                      onClick={(e) => handleRemoveFavorite(e, sneaker.id)}
                      className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-indigo-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs font-medium rounded-lg">
                        {sneaker.brand}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-lg ${
                        sneaker.priceChange.startsWith('+') 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {sneaker.priceChange}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold mb-1 group-hover:text-indigo-400 transition-colors line-clamp-2">
                      {sneaker.name}
                    </h3>
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <p className="text-gray-500 text-xs">Current</p>
                        <p className="text-white font-bold">${sneaker.currentPrice}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-xs">Saved at</p>
                        <p className="text-gray-400">${sneaker.savedPrice}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedFavorites.map((sneaker) => (
                <Link
                  key={sneaker.id}
                  to={`/sneaker/${sneaker.sneakerId}`}
                  state={{ sneaker: {
                    id: sneaker.sneakerId,
                    name: sneaker.name,
                    brand: sneaker.brand,
                    colorway: sneaker.colorway,
                    styleCode: sneaker.styleCode,
                    releaseDate: sneaker.releaseDate,
                    retailPrice: sneaker.retailPrice,
                    gender: sneaker.gender,
                    volatility: sneaker.volatility
                  }}}
                  className="flex items-center gap-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 hover:border-indigo-500/50 transition-all"
                >
                  {/* Image */}
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs font-medium rounded-lg">
                        {sneaker.brand}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold truncate">{sneaker.name}</h3>
                    <p className="text-gray-400 text-sm">Added {sneaker.addedDate}</p>
                  </div>

                  {/* Price Info */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-white font-bold text-xl">${sneaker.currentPrice}</p>
                    <p className={`text-sm font-medium ${
                      sneaker.priceChange.startsWith('+') ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {sneaker.priceChange} since saved
                    </p>
                  </div>

                  {/* Remove Button */}
                  <button 
                    onClick={(e) => handleRemoveFavorite(e, sneaker.id)}
                    className="p-3 bg-white/5 rounded-xl text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </Link>
              ))}
            </div>
          )
        ) : (
          // Empty State
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No favorites yet</h3>
            <p className="text-gray-400 mb-6">Start adding sneakers to track their prices</p>
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse Sneakers
            </Link>
          </div>
        )}
        </div>
      </div>
    </Layout>
  );
}

export default Favorites;

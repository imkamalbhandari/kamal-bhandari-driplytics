import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { listingsAPI, sneakerAPI } from '../services/api';

function Trade() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('marketplace');
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  // Create listing modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchingShoe, setSearchingShoe] = useState(false);
  const [selectedShoe, setSelectedShoe] = useState(null);
  const [newListing, setNewListing] = useState({
    size: '',
    condition: 'new',
    askingPrice: '',
    description: ''
  });

  // Edit listing modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [editListing, setEditListing] = useState({
    size: '',
    condition: 'new',
    askingPrice: '',
    description: ''
  });
  
  // Buy confirmation modal
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [buyLoading, setBuyLoading] = useState(false);
  
  // Messages
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'marketplace') {
        const [listingsRes, statsRes] = await Promise.all([
          listingsAPI.getAll({ 
            search: searchQuery, 
            brand: brandFilter, 
            condition: conditionFilter,
            sort: sortBy 
          }),
          listingsAPI.getStats()
        ]);
        if (listingsRes.success) setListings(listingsRes.data);
        if (statsRes.success) setStats(statsRes.data);
      } else if (activeTab === 'my-listings') {
        const response = await listingsAPI.getMyListings();
        if (response.success) setMyListings(response.data);
      } else if (activeTab === 'purchases') {
        const response = await listingsAPI.getPurchases();
        if (response.success) setPurchases(response.data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    fetchData();
  };

  const handleSearchShoe = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchingShoe(true);
    try {
      const response = await sneakerAPI.search(query);
      if (response.success) {
        setSearchResults(response.data.slice(0, 8));
      }
    } catch (err) {
      console.error('Error searching shoes:', err);
    } finally {
      setSearchingShoe(false);
    }
  };

  const handleSelectShoe = (shoe) => {
    setSelectedShoe(shoe);
    setSearchResults([]);
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    if (!selectedShoe) {
      setMessage({ type: 'error', text: 'Please select a shoe first' });
      return;
    }
    if (!newListing.size || !newListing.askingPrice) {
      setMessage({ type: 'error', text: 'Size and asking price are required' });
      return;
    }

    setCreateLoading(true);
    try {
      const listingData = {
        sneakerId: selectedShoe.Name.replace(/\s+/g, '-').toLowerCase(),
        name: selectedShoe.Name,
        brand: selectedShoe.Brand,
        colorway: '',
        styleCode: '',
        size: newListing.size,
        condition: newListing.condition,
        askingPrice: Number(newListing.askingPrice),
        retailPrice: selectedShoe.RetailPrice || 0,
        description: newListing.description,
        image: selectedShoe.Image || null
      };

      const response = await listingsAPI.create(listingData);
      if (response.success) {
        setMessage({ type: 'success', text: 'Listing created successfully!' });
        setShowCreateModal(false);
        setSelectedShoe(null);
        setNewListing({ size: '', condition: 'new', askingPrice: '', description: '' });
        fetchData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create listing' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!selectedListing) return;
    
    setBuyLoading(true);
    try {
      const response = await listingsAPI.buy(selectedListing.id);
      if (response.success) {
        setMessage({ type: 'success', text: 'Purchase successful! Contact the seller to arrange delivery.' });
        setShowBuyModal(false);
        setSelectedListing(null);
        fetchData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to complete purchase' });
    } finally {
      setBuyLoading(false);
    }
  };

  const handleCancelListing = async (id) => {
    try {
      const response = await listingsAPI.delete(id);
      if (response.success) {
        setMessage({ type: 'success', text: 'Listing cancelled successfully!' });
        fetchData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to cancel listing' });
    }
  };

  const openEditModal = (listing) => {
    setEditingListing(listing);
    setEditListing({
      size: listing.size || '',
      condition: listing.condition || 'new',
      askingPrice: listing.askingPrice || '',
      description: listing.description || ''
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingListing(null);
    setEditListing({
      size: '',
      condition: 'new',
      askingPrice: '',
      description: ''
    });
  };

  const handleUpdateListing = async (e) => {
    e.preventDefault();
    if (!editingListing) return;

    if (!editListing.size || !editListing.askingPrice) {
      setMessage({ type: 'error', text: 'Size and asking price are required' });
      return;
    }

    setEditLoading(true);
    try {
      const payload = {
        size: editListing.size,
        condition: editListing.condition,
        askingPrice: Number(editListing.askingPrice),
        description: editListing.description
      };

      const response = await listingsAPI.update(editingListing.id, payload);
      if (response.success) {
        setMessage({ type: 'success', text: 'Listing updated successfully!' });
        closeEditModal();
        fetchData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update listing' });
    } finally {
      setEditLoading(false);
    }
  };

  const conditionLabels = {
    'new': 'Brand New',
    'like-new': 'Like New',
    'good': 'Good',
    'fair': 'Fair'
  };

  const conditionColors = {
    'new': 'text-green-400 bg-green-400/10',
    'like-new': 'text-blue-400 bg-blue-400/10',
    'good': 'text-yellow-400 bg-yellow-400/10',
    'fair': 'text-orange-400 bg-orange-400/10'
  };

  return (
    <Layout requireAuth>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Trade</h1>
            <p className="text-gray-400">Buy and sell sneakers with the community</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            List a Shoe
          </button>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {message.text}
            <button onClick={() => setMessage({ type: '', text: '' })} className="float-right">&times;</button>
          </div>
        )}

        {/* Stats (only on marketplace tab) */}
        {activeTab === 'marketplace' && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <p className="text-gray-400 text-sm mb-1">Active Listings</p>
              <p className="text-2xl font-bold text-white">{stats.totalActive}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <p className="text-gray-400 text-sm mb-1">Sold</p>
              <p className="text-2xl font-bold text-green-400">{stats.totalSold}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <p className="text-gray-400 text-sm mb-1">Avg Price</p>
              <p className="text-2xl font-bold text-white">${stats.avgPrice}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <p className="text-gray-400 text-sm mb-1">Top Brand</p>
              <p className="text-2xl font-bold text-indigo-400">{stats.topBrands?.[0]?.brand || 'N/A'}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white/5 rounded-xl p-1 w-fit">
          {['marketplace', 'my-listings', 'purchases'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab === 'marketplace' ? 'Marketplace' : tab === 'my-listings' ? 'My Listings' : 'My Purchases'}
            </button>
          ))}
        </div>

        {/* Filters (marketplace only) */}
        {activeTab === 'marketplace' && (
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search sneakers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <select
              value={brandFilter}
              onChange={(e) => { setBrandFilter(e.target.value); handleSearch(); }}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none cursor-pointer"
            >
              <option value="" className="bg-gray-900">All Brands</option>
              <option value="Nike" className="bg-gray-900">Nike</option>
              <option value="Jordan" className="bg-gray-900">Jordan</option>
              <option value="Adidas" className="bg-gray-900">Adidas</option>
              <option value="New Balance" className="bg-gray-900">New Balance</option>
              <option value="Yeezy" className="bg-gray-900">Yeezy</option>
            </select>
            <select
              value={conditionFilter}
              onChange={(e) => { setConditionFilter(e.target.value); handleSearch(); }}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none cursor-pointer"
            >
              <option value="" className="bg-gray-900">All Conditions</option>
              <option value="new" className="bg-gray-900">Brand New</option>
              <option value="like-new" className="bg-gray-900">Like New</option>
              <option value="good" className="bg-gray-900">Good</option>
              <option value="fair" className="bg-gray-900">Fair</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); handleSearch(); }}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none cursor-pointer"
            >
              <option value="newest" className="bg-gray-900">Newest First</option>
              <option value="oldest" className="bg-gray-900">Oldest First</option>
              <option value="price-low" className="bg-gray-900">Price: Low to High</option>
              <option value="price-high" className="bg-gray-900">Price: High to Low</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
            >
              Search
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="w-full min-h-[40vh] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <>
            {/* Marketplace Tab */}
            {activeTab === 'marketplace' && (
              listings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {listings.map((listing) => (
                    <div
                      key={listing.id}
                      className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:border-indigo-500/50 transition-all group"
                    >
                      {/* Image */}
                      <div className="aspect-square bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden">
                        {listing.image ? (
                          <img 
                            src={listing.image} 
                            alt={listing.name}
                            className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className={`absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-medium ${conditionColors[listing.condition]}`}>
                          {conditionLabels[listing.condition]}
                        </div>
                      </div>
                      
                      {/* Info */}
                      <div className="p-4">
                        <p className="text-indigo-400 text-sm font-medium mb-1">{listing.brand}</p>
                        <h3 className="text-white font-semibold mb-2 line-clamp-2">{listing.name}</h3>
                        <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
                          <span>Size: {listing.size}</span>
                          <span>•</span>
                          <span>@{listing.sellerUsername}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-2xl font-bold text-white">${listing.askingPrice}</p>
                          {!listing.isOwner && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => navigate(`/chat?user=${listing.sellerId}&listing=${listing.id}`)}
                                className="p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
                                title="Chat with seller"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => { setSelectedListing(listing); setShowBuyModal(true); }}
                                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all text-sm font-medium"
                              >
                                Buy
                              </button>
                            </div>
                          )}
                          {listing.isOwner && (
                            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm">Your Listing</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-gray-400 text-lg mb-2">No listings found</p>
                  <p className="text-gray-500">Be the first to list a shoe!</p>
                </div>
              )
            )}

            {/* My Listings Tab */}
            {activeTab === 'my-listings' && (
              myListings.length > 0 ? (
                <div className="space-y-4">
                  {myListings.map((listing) => (
                    <div
                      key={listing.id}
                      className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 flex gap-4"
                    >
                      <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden flex-shrink-0">
                        {listing.image ? (
                          <img src={listing.image} alt={listing.name} className="w-full h-full object-contain p-2" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-indigo-400 text-sm font-medium">{listing.brand}</p>
                            <h3 className="text-white font-semibold">{listing.name}</h3>
                            <p className="text-gray-400 text-sm">Size: {listing.size} • {conditionLabels[listing.condition]}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-white">${listing.askingPrice}</p>
                            <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${
                              listing.status === 'active' ? 'bg-green-500/20 text-green-400' :
                              listing.status === 'sold' ? 'bg-blue-500/20 text-blue-400' :
                              listing.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              listing.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {listing.status === 'active' ? 'Active' : 
                               listing.status === 'sold' ? `Sold to @${listing.buyerUsername}` : 
                               listing.status === 'pending' ? 'Pending Approval' :
                               listing.status === 'rejected' ? 'Rejected' : 'Cancelled'}
                            </span>
                            {listing.status === 'rejected' && listing.rejectionReason && (
                              <p className="text-red-400 text-xs mt-1">{listing.rejectionReason}</p>
                            )}
                          </div>
                        </div>
                        {listing.status === 'active' && (
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(listing)}
                              className="px-3 py-1 text-indigo-300 hover:bg-indigo-500/20 rounded-lg text-sm transition-all"
                            >
                              Edit Details
                            </button>
                            <button
                              onClick={() => handleCancelListing(listing.id)}
                              className="px-3 py-1 text-red-400 hover:bg-red-500/20 rounded-lg text-sm transition-all"
                            >
                              Cancel Listing
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-gray-400 text-lg mb-2">No listings yet</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    Create your first listing
                  </button>
                </div>
              )
            )}

            {/* Purchases Tab */}
            {activeTab === 'purchases' && (
              purchases.length > 0 ? (
                <div className="space-y-4">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 flex gap-4"
                    >
                      <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden flex-shrink-0">
                        {purchase.image ? (
                          <img src={purchase.image} alt={purchase.name} className="w-full h-full object-contain p-2" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-indigo-400 text-sm font-medium">{purchase.brand}</p>
                            <h3 className="text-white font-semibold">{purchase.name}</h3>
                            <p className="text-gray-400 text-sm">Size: {purchase.size} • {conditionLabels[purchase.condition]}</p>
                            <p className="text-gray-500 text-sm">Bought from @{purchase.sellerUsername}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-white">${purchase.askingPrice}</p>
                            <p className="text-gray-500 text-xs">
                              {new Date(purchase.purchasedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <p className="text-gray-400 text-lg mb-2">No purchases yet</p>
                  <button
                    onClick={() => setActiveTab('marketplace')}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    Browse the marketplace
                  </button>
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Create Listing Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">List a Shoe for Sale</h2>
                <button
                  onClick={() => { setShowCreateModal(false); setSelectedShoe(null); setSearchResults([]); }}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <form onSubmit={handleCreateListing} className="p-6 space-y-4">
              {/* Search for shoe */}
              {!selectedShoe ? (
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Search for a shoe</label>
                  <input
                    type="text"
                    placeholder="Search by name, brand, or style code..."
                    onChange={(e) => handleSearchShoe(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                  {searchingShoe && (
                    <div className="mt-2 text-gray-400 text-sm">Searching...</div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="mt-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                      {searchResults.map((shoe, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectShoe(shoe)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-white/10 transition-all text-left border-b border-white/5 last:border-0"
                        >
                          {shoe.Image ? (
                            <img src={shoe.Image} alt={shoe.Name} className="w-12 h-12 object-contain bg-gray-800 rounded-lg" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                              <span className="text-gray-600 text-xs">No img</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{shoe.Name}</p>
                            <p className="text-gray-400 text-sm">{shoe.Brand}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Selected Shoe</label>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                    {selectedShoe.Image ? (
                      <img src={selectedShoe.Image} alt={selectedShoe.Name} className="w-16 h-16 object-contain bg-gray-800 rounded-lg" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center">
                        <span className="text-gray-600 text-xs">No img</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{selectedShoe.Name}</p>
                      <p className="text-gray-400 text-sm">{selectedShoe.Brand}</p>
                      {selectedShoe.RetailPrice && (
                        <p className="text-gray-500 text-sm">Retail: ${selectedShoe.RetailPrice}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedShoe(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Size */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Size (US)</label>
                <input
                  type="text"
                  placeholder="e.g., 10, 10.5"
                  value={newListing.size}
                  onChange={(e) => setNewListing({ ...newListing, size: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Condition */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Condition</label>
                <select
                  value={newListing.condition}
                  onChange={(e) => setNewListing({ ...newListing, condition: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none cursor-pointer"
                >
                  <option value="new" className="bg-gray-900">Brand New (DS)</option>
                  <option value="like-new" className="bg-gray-900">Like New (Worn 1-2 times)</option>
                  <option value="good" className="bg-gray-900">Good (Light wear)</option>
                  <option value="fair" className="bg-gray-900">Fair (Visible wear)</option>
                </select>
              </div>

              {/* Asking Price */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Asking Price ($)</label>
                <input
                  type="number"
                  placeholder="Enter your asking price"
                  value={newListing.askingPrice}
                  onChange={(e) => setNewListing({ ...newListing, askingPrice: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Description (optional)</label>
                <textarea
                  placeholder="Add any additional details about the shoe..."
                  value={newListing.description}
                  onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={createLoading || !selectedShoe}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLoading ? 'Creating...' : 'Create Listing'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Buy Confirmation Modal */}
      {showBuyModal && selectedListing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-md">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Confirm Purchase</h2>
            </div>
            
            <div className="p-6">
              <div className="flex gap-4 mb-6">
                {selectedListing.image ? (
                  <img src={selectedListing.image} alt={selectedListing.name} className="w-24 h-24 object-contain bg-gray-800 rounded-xl" />
                ) : (
                  <div className="w-24 h-24 bg-gray-800 rounded-xl flex items-center justify-center">
                    <span className="text-gray-600 text-xs">No img</span>
                  </div>
                )}
                <div>
                  <p className="text-indigo-400 text-sm font-medium">{selectedListing.brand}</p>
                  <h3 className="text-white font-semibold">{selectedListing.name}</h3>
                  <p className="text-gray-400 text-sm">Size: {selectedListing.size}</p>
                  <p className="text-gray-400 text-sm">{conditionLabels[selectedListing.condition]}</p>
                  <p className="text-gray-500 text-sm">Seller: @{selectedListing.sellerUsername}</p>
                </div>
              </div>
              
              <div className="bg-white/5 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total</span>
                  <span className="text-2xl font-bold text-white">${selectedListing.askingPrice}</span>
                </div>
              </div>

              <p className="text-gray-400 text-sm mb-6">
                By confirming, you agree to purchase this item. The seller will be notified and you can arrange payment and delivery directly.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowBuyModal(false); setSelectedListing(null); }}
                  className="flex-1 py-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBuy}
                  disabled={buyLoading}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-medium disabled:opacity-50"
                >
                  {buyLoading ? 'Processing...' : 'Confirm Purchase'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Listing Modal */}
      {showEditModal && editingListing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Edit Listing Details</h2>
                <button onClick={closeEditModal} className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdateListing} className="p-6 space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-indigo-400 text-sm font-medium">{editingListing.brand}</p>
                <p className="text-white font-semibold">{editingListing.name}</p>
                <p className="text-gray-500 text-xs mt-1">Only active listings can be updated</p>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Size (US)</label>
                <input
                  type="text"
                  placeholder="e.g., 10, 10.5"
                  value={editListing.size}
                  onChange={(e) => setEditListing({ ...editListing, size: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Condition</label>
                <select
                  value={editListing.condition}
                  onChange={(e) => setEditListing({ ...editListing, condition: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none cursor-pointer"
                >
                  <option value="new" className="bg-gray-900">Brand New (DS)</option>
                  <option value="like-new" className="bg-gray-900">Like New (Worn 1-2 times)</option>
                  <option value="good" className="bg-gray-900">Good (Light wear)</option>
                  <option value="fair" className="bg-gray-900">Fair (Visible wear)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Asking Price ($)</label>
                <input
                  type="number"
                  placeholder="Enter your updated price"
                  value={editListing.askingPrice}
                  onChange={(e) => setEditListing({ ...editListing, askingPrice: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Description (optional)</label>
                <textarea
                  placeholder="Add or update details about the shoe..."
                  value={editListing.description}
                  onChange={(e) => setEditListing({ ...editListing, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 py-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Trade;

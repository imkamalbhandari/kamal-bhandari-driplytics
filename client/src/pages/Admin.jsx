import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { adminAPI } from '../services/api';

function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [allListings, setAllListings] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [listingSearch, setListingSearch] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState('all');
  const [userSubFilter, setUserSubFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userListings, setUserListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!user.isAdmin) { navigate('/dashboard'); return; }
    fetchData();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers()
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (usersRes.success) setUsers(usersRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSearch = async (e) => {
    e.preventDefault();
    try {
      const res = await adminAPI.getUsers(userSearch);
      if (res.success) setUsers(res.data);
    } catch (error) { console.error('Search error:', error); }
  };

  const fetchListings = async () => {
    try {
      setListingsLoading(true);
      const res = await adminAPI.getListings(listingStatusFilter, listingSearch);
      if (res.success) setAllListings(res.data);
    } catch (error) { console.error('Error fetching listings:', error); }
    finally { setListingsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'listings') fetchListings();
  }, [activeTab, listingStatusFilter]);

  const viewUserListings = async (userId) => {
    if (selectedUser === userId) { setSelectedUser(null); setUserListings([]); return; }
    try {
      setSelectedUser(userId);
      setListingsLoading(true);
      const res = await adminAPI.getUserListings(userId);
      if (res.success) setUserListings(res.data);
    } catch (error) { console.error('Error fetching listings:', error); }
    finally { setListingsLoading(false); }
  };

  const handleToggleAdmin = async (userId, username) => {
    try {
      setActionLoading(userId);
      const res = await adminAPI.toggleAdmin(userId);
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isAdmin: res.isAdmin } : u));
        showToast(res.message);
      }
    } catch (error) { showToast('Error toggling admin status', 'error'); }
    finally { setActionLoading(null); }
  };

  const handleDeleteUser = async (userId) => {
    try {
      setActionLoading(userId);
      const res = await adminAPI.deleteUser(userId);
      if (res.success) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        if (selectedUser === userId) { setSelectedUser(null); setUserListings([]); }
        setDeleteConfirm(null);
        showToast('User deleted successfully');
        const statsRes = await adminAPI.getStats();
        if (statsRes.success) setStats(statsRes.data);
      }
    } catch (error) { showToast('Error deleting user', 'error'); }
    finally { setActionLoading(null); }
  };

  const handleDeleteListing = async (listingId, fromTab = 'users') => {
    try {
      setActionLoading(listingId);
      const res = await adminAPI.deleteListing(listingId);
      if (res.success) {
        if (fromTab === 'users') {
          setUserListings(prev => prev.filter(l => l.id !== listingId));
          setUsers(prev => prev.map(u => u.id === selectedUser ? { ...u, listingCount: u.listingCount - 1 } : u));
        } else {
          setAllListings(prev => prev.filter(l => l.id !== listingId));
        }
        showToast('Listing deleted');
        const statsRes = await adminAPI.getStats();
        if (statsRes.success) setStats(statsRes.data);
      }
    } catch (error) { showToast('Error deleting listing', 'error'); }
    finally { setActionLoading(null); }
  };

  const handleUpdateListingStatus = async (listingId, status) => {
    try {
      setActionLoading(listingId);
      const res = await adminAPI.updateListingStatus(listingId, status);
      if (res.success) {
        setAllListings(prev => prev.map(l => l.id === listingId ? { ...l, status } : l));
        showToast(res.message);
        const statsRes = await adminAPI.getStats();
        if (statsRes.success) setStats(statsRes.data);
      }
    } catch (error) { showToast('Error updating listing', 'error'); }
    finally { setActionLoading(null); }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const statusColors = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    sold: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'revenue', label: 'Revenue', icon: '💰' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'listings', label: 'Listings', icon: '📦' }
  ];

  if (loading) {
    return (
      <Layout requireAuth adminAllowed>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth adminAllowed>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all animate-slide-in ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-1">Admin Panel</h1>
          <p className="text-gray-400">Manage your platform</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-8 border border-white/10 w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ==================== OVERVIEW TAB ==================== */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-8">
            {/* Stat Cards - Row 1 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[  
                { label: 'Total Users', value: stats.users.total, sub: `${stats.users.newThisWeek} new this week`, icon: '👥', color: 'from-indigo-500 to-purple-600' },
                { label: 'Subscribers', value: stats.subscriptionRevenue?.activeSubscribers || 0, sub: `${stats.subscriptionRevenue?.premiumCount || 0} premium · ${stats.subscriptionRevenue?.proCount || 0} pro`, icon: '⭐', color: 'from-yellow-500 to-orange-600' },
                { label: 'Subscription Revenue', value: `रू ${(stats.subscriptionRevenue?.totalRevenue || 0).toLocaleString()}`, sub: `रू ${(stats.subscriptionRevenue?.thisMonthRevenue || 0).toLocaleString()} this month`, icon: '💰', color: 'from-green-500 to-emerald-600' },
                { label: 'Total Listings', value: stats.listings.total, sub: `${stats.listings.active} active`, icon: '📦', color: 'from-blue-500 to-cyan-600' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5 hover:border-white/20 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-lg`}>{s.icon}</div>
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-gray-400 text-sm mt-1">{s.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Stat Cards - Row 2 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Pending', value: stats.listings.pending, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                { label: 'Active', value: stats.listings.active, color: 'text-green-400', bg: 'bg-green-500/10' },
                { label: 'Sold', value: stats.listings.sold, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Rejected', value: stats.listings.rejected, color: 'text-red-400', bg: 'bg-red-500/10' },
                { label: 'Avg Sale Price', value: `$${stats.revenue.average.toLocaleString()}`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl border border-white/5 p-4 text-center`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-400 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Messages & Conversations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><span>💬</span> Messages</h3>
                <div className="flex gap-8">
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.messages.total}</p>
                    <p className="text-gray-400 text-xs">Total Messages</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.messages.conversations}</p>
                    <p className="text-gray-400 text-xs">Conversations</p>
                  </div>
                </div>
              </div>

              {/* Brand Distribution */}
              <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><span>🏷️</span> Top Brands</h3>
                <div className="space-y-2">
                  {stats.brandStats.slice(0, 5).map(b => (
                    <div key={b._id} className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">{b._id || 'Unknown'}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(b.count / (stats.brandStats[0]?.count || 1)) * 100}%` }} />
                        </div>
                        <span className="text-gray-400 text-xs w-8 text-right">{b.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Two columns: Recent Users + Top Sellers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Users */}
              <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-5 border-b border-white/10">
                  <h3 className="text-white font-semibold flex items-center gap-2"><span>🆕</span> Recent Users</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {stats.recentUsers.map(u => (
                    <div key={u.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/5 transition-all">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs">{u.username?.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{u.username}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </div>
                      <span className="text-gray-500 text-xs flex-shrink-0">{formatDate(u.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Sellers */}
              <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-5 border-b border-white/10">
                  <h3 className="text-white font-semibold flex items-center gap-2"><span>🏆</span> Top Sellers</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {stats.topSellers.length === 0 ? (
                    <div className="px-5 py-8 text-center text-gray-500 text-sm">No sales yet</div>
                  ) : (
                    stats.topSellers.map((s, i) => (
                      <div key={s._id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/5 transition-all">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-gray-400/20 text-gray-300' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-gray-400'
                        }`}>
                          <span className="font-bold text-xs">#{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{s._id}</p>
                          <p className="text-gray-500 text-xs">{s.count} sale{s.count !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-green-400 font-bold text-sm flex-shrink-0">${s.totalSales.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Recent Listings + Recent Sales */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Listings */}
              <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-5 border-b border-white/10">
                  <h3 className="text-white font-semibold flex items-center gap-2"><span>📋</span> Recent Listings</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {stats.recentListings.map(l => (
                    <div key={l.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/5 transition-all">
                      {l.image ? (
                        <img src={l.image} alt="" className="w-10 h-10 rounded-lg object-contain bg-white/5 flex-shrink-0" onError={(e) => e.target.style.display='none'} />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{l.name}</p>
                        <p className="text-gray-500 text-xs">by {l.sellerUsername}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white font-bold text-sm">${l.askingPrice}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[l.status]}`}>{l.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Sales */}
              <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-5 border-b border-white/10">
                  <h3 className="text-white font-semibold flex items-center gap-2"><span>💸</span> Recent Sales</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {stats.recentSales.length === 0 ? (
                    <div className="px-5 py-8 text-center text-gray-500 text-sm">No sales yet</div>
                  ) : (
                    stats.recentSales.map(l => (
                      <div key={l.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/5 transition-all">
                        {l.image ? (
                          <img src={l.image} alt="" className="w-10 h-10 rounded-lg object-contain bg-white/5 flex-shrink-0" onError={(e) => e.target.style.display='none'} />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{l.name}</p>
                          <p className="text-gray-500 text-xs">{l.sellerUsername} → {l.buyerUsername}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-green-400 font-bold text-sm">${l.askingPrice}</p>
                          <p className="text-gray-500 text-xs">{formatDate(l.soldAt)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== REVENUE TAB ==================== */}
        {activeTab === 'revenue' && stats && (
          <div className="space-y-6">
            {/* Revenue KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Subscription Revenue', value: `रू ${(stats.subscriptionRevenue?.totalRevenue || 0).toLocaleString()}`, icon: '💰', color: 'from-green-500 to-emerald-600', sub: `${stats.subscriptionRevenue?.totalPayments || 0} payments` },
                { label: 'This Month', value: `रू ${(stats.subscriptionRevenue?.thisMonthRevenue || 0).toLocaleString()}`, icon: '📅', color: 'from-violet-500 to-purple-600', sub: `${stats.subscriptionRevenue?.thisMonthPayments || 0} new subscriptions` },
                { label: 'Active Subscribers', value: stats.subscriptionRevenue?.activeSubscribers || 0, icon: '⭐', color: 'from-yellow-500 to-orange-600', sub: `${stats.subscriptionRevenue?.expiredSubscribers || 0} expired` },
                { label: 'Avg Payment', value: `रू ${(stats.subscriptionRevenue?.avgPayment || 0).toLocaleString()}`, icon: '📊', color: 'from-blue-500 to-cyan-600', sub: 'per subscription' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5 hover:border-white/20 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-lg`}>{s.icon}</div>
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-gray-400 text-sm mt-1">{s.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Subscriber Breakdown + Revenue by Plan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Subscriber Breakdown */}
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><span>👥</span> Subscriber Breakdown</h3>
                <div className="space-y-4">
                  {/* Donut-style bars */}
                  {[
                    { label: 'Free Users', value: stats.subscriptionRevenue?.freeUsers || 0, color: 'bg-gray-500', pct: ((stats.subscriptionRevenue?.freeUsers || 0) / Math.max(stats.users.total, 1) * 100).toFixed(1) },
                    { label: 'Premium', value: stats.subscriptionRevenue?.premiumCount || 0, color: 'bg-violet-500', pct: ((stats.subscriptionRevenue?.premiumCount || 0) / Math.max(stats.users.total, 1) * 100).toFixed(1) },
                    { label: 'Pro', value: stats.subscriptionRevenue?.proCount || 0, color: 'bg-purple-500', pct: ((stats.subscriptionRevenue?.proCount || 0) / Math.max(stats.users.total, 1) * 100).toFixed(1) },
                    { label: 'Expired', value: stats.subscriptionRevenue?.expiredSubscribers || 0, color: 'bg-red-500', pct: ((stats.subscriptionRevenue?.expiredSubscribers || 0) / Math.max(stats.users.total, 1) * 100).toFixed(1) },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="text-gray-300 text-sm">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold text-sm">{item.value}</span>
                          <span className="text-gray-500 text-xs">({item.pct}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${Math.max(parseFloat(item.pct), 1)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue by Plan */}
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><span>💳</span> Revenue by Plan</h3>
                {(stats.subscriptionRevenue?.revenueByPlan || []).length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">No subscription payments yet</div>
                ) : (
                  <div className="space-y-4">
                    {(stats.subscriptionRevenue?.revenueByPlan || []).map(plan => (
                      <div key={plan.plan} className={`p-4 rounded-xl border ${
                        plan.plan === 'pro' ? 'bg-purple-500/10 border-purple-500/20' : 'bg-violet-500/10 border-violet-500/20'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-bold uppercase ${
                            plan.plan === 'pro' ? 'text-purple-300' : 'text-violet-300'
                          }`}>{plan.plan}</span>
                          <span className="text-white font-bold">रू {plan.revenue.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>{plan.count} subscription{plan.count !== 1 ? 's' : ''}</span>
                          <span>रू {Math.round(plan.revenue / Math.max(plan.count, 1))} avg</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Monthly Revenue Trend */}
                {(stats.subscriptionRevenue?.monthlyRevenue || []).length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Monthly Trend</h4>
                    <div className="flex items-end gap-2 h-24">
                      {(stats.subscriptionRevenue?.monthlyRevenue || []).map((m, i) => {
                        const maxRev = Math.max(...(stats.subscriptionRevenue?.monthlyRevenue || []).map(x => x.revenue), 1);
                        const height = Math.max((m.revenue / maxRev) * 100, 8);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-gray-400 text-[10px]">रू{m.revenue}</span>
                            <div
                              className="w-full bg-gradient-to-t from-violet-600 to-purple-500 rounded-t-md transition-all"
                              style={{ height: `${height}%` }}
                              title={`${m.month}: रू${m.revenue} (${m.count} payments)`}
                            />
                            <span className="text-gray-500 text-[10px]">{m.month.split('-')[1]}/{m.month.split('-')[0].slice(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Payments Table */}
            <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-5 border-b border-white/10">
                <h3 className="text-white font-semibold flex items-center gap-2"><span>🧾</span> Recent Payments</h3>
              </div>
              {(stats.subscriptionRevenue?.recentPayments || []).length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">No payments recorded yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left text-gray-400 text-xs font-medium px-5 py-3 uppercase tracking-wider">User</th>
                        <th className="text-left text-gray-400 text-xs font-medium px-5 py-3 uppercase tracking-wider">Plan</th>
                        <th className="text-left text-gray-400 text-xs font-medium px-5 py-3 uppercase tracking-wider">Amount</th>
                        <th className="text-left text-gray-400 text-xs font-medium px-5 py-3 uppercase tracking-wider">Duration</th>
                        <th className="text-left text-gray-400 text-xs font-medium px-5 py-3 uppercase tracking-wider">Date</th>
                        <th className="text-left text-gray-400 text-xs font-medium px-5 py-3 uppercase tracking-wider">Transaction ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(stats.subscriptionRevenue?.recentPayments || []).map(p => (
                        <tr key={p.id} className="hover:bg-white/5 transition-all">
                          <td className="px-5 py-3">
                            <div>
                              <p className="text-white text-sm font-medium">{p.username}</p>
                              <p className="text-gray-500 text-xs">{p.email}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${
                              p.plan === 'pro' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            }`}>{p.plan}</span>
                          </td>
                          <td className="px-5 py-3 text-green-400 font-semibold text-sm">रू {p.amount}</td>
                          <td className="px-5 py-3 text-gray-300 text-sm">{p.duration} days</td>
                          <td className="px-5 py-3 text-gray-400 text-sm">{formatDate(p.date)}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs font-mono truncate max-w-[140px]">{p.transactionId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== USERS TAB ==================== */}
        {activeTab === 'users' && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-semibold text-white">Users ({users.length})</h2>
                {/* Subscription filter pills */}
                <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'subscribed', label: 'Subscribed' },
                    { id: 'free', label: 'Free' },
                    { id: 'expired', label: 'Expired' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setUserSubFilter(f.id)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        userSubFilter === f.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <form onSubmit={handleUserSearch} className="flex gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  className="flex-1 sm:w-64 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                />
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-medium">Search</button>
                {userSearch && (
                  <button type="button" onClick={() => { setUserSearch(''); adminAPI.getUsers().then(res => res.success && setUsers(res.data)); }}
                    className="px-3 py-2 bg-white/10 text-gray-300 rounded-xl hover:bg-white/20 transition-all text-sm">Clear</button>
                )}
              </form>
            </div>

            <div className="divide-y divide-white/5">
              {users
                .filter(u => {
                  if (userSubFilter === 'all') return true;
                  if (userSubFilter === 'subscribed') return u.subscriptionActive;
                  if (userSubFilter === 'free') return !u.subscription?.type || u.subscription.type === 'free';
                  if (userSubFilter === 'expired') return u.subscription?.type && u.subscription.type !== 'free' && !u.subscriptionActive;
                  return true;
                })
                .map((u) => (
                <div key={u.id}>
                  <div className="p-4 sm:p-6 hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-lg">{u.username?.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-medium truncate">{u.username}</p>
                          {u.isAdmin && <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-full font-medium">Admin</span>}
                          {u.twoFactorEnabled && <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">2FA</span>}
                          {u.subscriptionActive ? (
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${
                              u.subscription?.type === 'pro' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                            }`}>
                              {u.subscription?.type} · {u.subscriptionDaysLeft}d left
                            </span>
                          ) : u.subscription?.type && u.subscription.type !== 'free' ? (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-medium border border-red-500/30">Expired</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full font-medium">Free</span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm truncate">{u.email}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          <span>Joined {formatDate(u.createdAt)}</span>
                          <span>•</span>
                          <span>{u.listingCount} listing{u.listingCount !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span>{u.soldCount} sold</span>
                          <span>•</span>
                          <span>{u.freePredictionsUsed}/5 predictions used</span>
                          {u.revenue > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-green-400">${Math.round(u.revenue).toLocaleString()} commission</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        <button onClick={() => viewUserListings(u.id)}
                          className={`px-3 py-2 text-sm rounded-xl transition-all ${selectedUser === u.id ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                          {selectedUser === u.id ? 'Hide' : 'Listings'}
                        </button>
                        {u.id !== user.id && (
                          <>
                            <button onClick={() => handleToggleAdmin(u.id, u.username)} disabled={actionLoading === u.id}
                              className={`px-3 py-2 text-sm rounded-xl transition-all ${u.isAdmin ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                              title={u.isAdmin ? 'Remove admin' : 'Make admin'}>
                              {actionLoading === u.id ? '...' : u.isAdmin ? 'Demote' : 'Promote'}
                            </button>
                            <button onClick={() => setDeleteConfirm(u.id)}
                              className="p-2 text-gray-500 hover:text-red-400 transition-all" title="Delete user">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delete Confirmation */}
                  {deleteConfirm === u.id && (
                    <div className="px-6 pb-4">
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
                        <p className="text-red-400 text-sm">Delete <strong>{u.username}</strong> and all their listings?</p>
                        <div className="flex gap-2">
                          <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 bg-white/10 text-gray-300 rounded-lg text-sm hover:bg-white/20">Cancel</button>
                          <button onClick={() => handleDeleteUser(u.id)} disabled={actionLoading === u.id}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                            {actionLoading === u.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User Listings */}
                  {selectedUser === u.id && (
                    <div className="px-6 pb-6">
                      {listingsLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                        </div>
                      ) : userListings.length === 0 ? (
                        <div className="text-center py-6 bg-white/5 rounded-xl"><p className="text-gray-400">No listings</p></div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {userListings.map(listing => (
                            <div key={listing.id} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden group">
                              {listing.image && (
                                <div className="h-32 bg-white/5 overflow-hidden">
                                  <img src={listing.image} alt={listing.name} className="w-full h-full object-contain" onError={(e) => e.target.style.display='none'} />
                                </div>
                              )}
                              <div className="p-4">
                                <h4 className="text-white font-medium text-sm truncate mb-1">{listing.name}</h4>
                                <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                                  <span>{listing.brand}</span><span className="text-gray-600">•</span>
                                  <span>Size {listing.size}</span><span className="text-gray-600">•</span>
                                  <span className="capitalize">{listing.condition}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <p className="text-white font-bold">${listing.askingPrice}</p>
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[listing.status]}`}>{listing.status}</span>
                                    <button onClick={() => handleDeleteListing(listing.id, 'users')}
                                      className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="Delete">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                                {listing.soldAt && <p className="text-gray-500 text-xs mt-2">Sold {formatDate(listing.soldAt)} to {listing.buyerUsername}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {users.length === 0 && (
              <div className="text-center py-12"><p className="text-gray-400">No users found</p></div>
            )}
          </div>
        )}

        {/* ==================== LISTINGS TAB ==================== */}
        {activeTab === 'listings' && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            {/* Filters */}
            <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                {['all', 'pending', 'active', 'sold', 'rejected', 'cancelled'].map(s => (
                  <button key={s} onClick={() => setListingStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                      listingStatusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); fetchListings(); }} className="flex gap-2 w-full sm:w-auto">
                <input type="text" value={listingSearch} onChange={(e) => setListingSearch(e.target.value)}
                  placeholder="Search listings..."
                  className="flex-1 sm:w-56 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm" />
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-medium">Search</button>
              </form>
            </div>

            {/* Listings Grid */}
            {listingsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : allListings.length === 0 ? (
              <div className="text-center py-12"><p className="text-gray-400">No listings found</p></div>
            ) : (
              <div className="divide-y divide-white/5">
                {allListings.map(listing => (
                  <div key={listing.id} className="p-4 sm:p-5 hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      {listing.image ? (
                        <img src={listing.image} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain bg-white/5 flex-shrink-0" onError={(e) => e.target.style.display='none'} />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white/5 flex-shrink-0 flex items-center justify-center text-gray-600">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{listing.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                          <span>{listing.brand}</span>
                          {listing.colorway && <><span className="text-gray-600">•</span><span>{listing.colorway}</span></>}
                          {listing.size && <><span className="text-gray-600">•</span><span>Size {listing.size}</span></>}
                          {listing.condition && <><span className="text-gray-600">•</span><span className="capitalize">{listing.condition}</span></>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>by {listing.sellerUsername}</span>
                          <span>•</span>
                          <span>{formatDate(listing.createdAt)}</span>
                          {listing.buyerUsername && (
                            <><span>•</span><span>Bought by {listing.buyerUsername}</span></>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-white font-bold">${listing.askingPrice}</p>
                            {listing.retailPrice && listing.retailPrice !== listing.askingPrice && (
                              <p className="text-gray-500 text-xs">Retail: ${listing.retailPrice}</p>
                            )}
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColors[listing.status]}`}>{listing.status}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {listing.status === 'pending' && (
                            <>
                              <button onClick={() => handleUpdateListingStatus(listing.id, 'active')} disabled={actionLoading === listing.id}
                                className="px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition-all font-medium">
                                Approve
                              </button>
                              <button onClick={() => handleUpdateListingStatus(listing.id, 'rejected')} disabled={actionLoading === listing.id}
                                className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition-all font-medium">
                                Reject
                              </button>
                            </>
                          )}
                          {listing.status === 'rejected' && (
                            <button onClick={() => handleUpdateListingStatus(listing.id, 'active')} disabled={actionLoading === listing.id}
                              className="px-2.5 py-1 bg-green-600/20 text-green-400 rounded-lg text-xs hover:bg-green-600/30 transition-all font-medium">
                              Reactivate
                            </button>
                          )}
                          {listing.status === 'active' && (
                            <button onClick={() => handleUpdateListingStatus(listing.id, 'cancelled')} disabled={actionLoading === listing.id}
                              className="px-2.5 py-1 bg-gray-600/20 text-gray-400 rounded-lg text-xs hover:bg-gray-600/30 transition-all font-medium">
                              Cancel
                            </button>
                          )}
                          <button onClick={() => handleDeleteListing(listing.id, 'listings')} disabled={actionLoading === listing.id}
                            className="p-1.5 text-gray-500 hover:text-red-400 transition-all" title="Delete listing">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}

export default Admin;

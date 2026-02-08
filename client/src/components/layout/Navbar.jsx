import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const user = (() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  })();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setShowLogoutModal(false);
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )},
    { path: '/search', label: 'Search', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )},
    { path: '/trends', label: 'Prediction', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )},
    { path: '/compare', label: 'Compare', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    { path: '/favorites', label: 'Favorites', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    )},
    { path: '/alerts', label: 'Alerts', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    )},
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-black/70 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all duration-300 group-hover:scale-105">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <span className="text-xl font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">Driplytics</span>
          </Link>

          {/* Desktop Navigation */}
          {user && (
            <div className="hidden md:flex items-center gap-1 bg-white/5 rounded-xl p-1 backdrop-blur-sm">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(link.path)
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`transition-transform duration-200 ${isActive(link.path) ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {link.icon}
                  </span>
                  {link.label}
                  {isActive(link.path) && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Profile dropdown */}
                <Link
                  to="/profile"
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                    isActive('/profile') ? 'bg-white/15 shadow-lg' : 'hover:bg-white/10'
                  }`}
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-white/20 hover:ring-white/40 transition-all shadow-lg">
                    <span className="text-white font-semibold text-sm">
                      {user.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white font-medium hidden sm:block">{user.username}</span>
                </Link>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="px-4 py-2 text-gray-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/30 rounded-lg transition-all text-sm font-medium border border-transparent"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex gap-3">
                <Link
                  to="/login"
                  className="px-4 py-2 text-white hover:text-indigo-300 font-medium transition-all hover:bg-white/5 rounded-lg"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:scale-105"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            {user && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <svg className="w-6 h-6 transition-transform duration-200" style={{ transform: mobileMenuOpen ? 'rotate(90deg)' : 'rotate(0)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {user && mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/10 animate-slide-up space-y-1">
            {navLinks.map((link, index) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all animate-fade-in ${
                  isActive(link.path)
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setShowLogoutModal(false)}
          ></div>
          
          {/* Modal */}
          <div className="relative bg-gradient-to-b from-gray-800 to-gray-900 border border-white/20 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            {/* Close button */}
            <button
              onClick={() => setShowLogoutModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              {/* Icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-red-500/30 to-orange-500/30 rounded-full flex items-center justify-center mx-auto mb-5 ring-4 ring-red-500/20">
                <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-3">Leaving So Soon?</h3>
              <p className="text-gray-400 mb-8 text-base">Are you sure you want to logout? You'll need to login again to access your dashboard.</p>
              
              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 px-6 py-3.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all font-semibold border border-white/10 hover:border-white/20"
                >
                  Stay Logged In
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl hover:from-red-700 hover:to-red-600 transition-all font-semibold shadow-lg shadow-red-500/30 hover:shadow-red-500/40"
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;

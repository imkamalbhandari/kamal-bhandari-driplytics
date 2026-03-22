import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();
  const [showLogoutToast, setShowLogoutToast] = useState(false);

  // Check for logout success message
  useEffect(() => {
    if (sessionStorage.getItem('logoutSuccess')) {
      setShowLogoutToast(true);
      sessionStorage.removeItem('logoutSuccess');
      // Auto-hide after 4 seconds
      const timer = setTimeout(() => setShowLogoutToast(false), 4000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Check if user is logged in
  const user = (() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  })();

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // If user is logged in, show nothing while redirecting
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Landing page for non-logged-in users
  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden">
      {/* Logout Success Toast */}
      {showLogoutToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="flex items-center gap-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl shadow-green-500/30 border border-green-400/20 backdrop-blur-sm">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-lg">Logged Out Successfully</p>
              <p className="text-green-100 text-sm">See you next time!</p>
            </div>
            <button 
              onClick={() => setShowLogoutToast(false)}
              className="ml-4 p-1 hover:bg-white/20 rounded-full transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-float-delayed animate-glow-pulse"></div>
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-indigo-400/5 rounded-full blur-2xl animate-float-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{ 
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }}></div>

      {/* Navigation */}
      <nav className="relative z-10 w-full bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              Driplytics
            </h1>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 text-white hover:text-indigo-300 font-medium transition-all hover:bg-white/5 rounded-lg"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:scale-105"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Landing Page */}
      <main className="relative z-10 flex-1 flex flex-col justify-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-600/20 border border-indigo-500/30 rounded-full px-5 py-2.5 mb-8 animate-fade-in backdrop-blur-sm shadow-lg shadow-indigo-500/10">
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
            <span className="text-indigo-300 text-sm font-medium tracking-wide">AI-Powered Sneaker Analytics</span>
          </div>

          <h2 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight animate-slide-up">
            Predict Sneaker<br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
              Resale Prices
            </span>
          </h2>
          
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto animate-fade-in leading-relaxed" style={{ animationDelay: '0.2s' }}>
            Make smarter buying and selling decisions with AI-powered price predictions, 
            market trends, and real-time analytics.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <button
              onClick={() => navigate('/signup')}
              className="group px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all font-semibold text-lg shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/40 transform hover:-translate-y-1 hover:scale-105"
            >
              <span className="flex items-center justify-center gap-2">
                Get Started Free
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all font-semibold text-lg border border-white/20 hover:border-white/30 backdrop-blur-sm hover:scale-105"
            >
              Login to Dashboard
            </button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 stagger-children">
            <div className="group text-left bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-indigo-500/40 transition-all duration-300 animate-slide-up card-hover glow-on-hover">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-600/30 to-indigo-600/10 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-indigo-500/10">
                <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-xl mb-3">Historical Data</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Track price history from StockX and eBay with interactive charts and detailed analytics</p>
            </div>

            <div className="group text-left bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-purple-500/40 transition-all duration-300 animate-slide-up card-hover glow-on-hover" style={{ animationDelay: '0.1s' }}>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600/30 to-purple-600/10 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-purple-500/10">
                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-xl mb-3">AI Predictions</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Machine learning models predict future resale values with high accuracy</p>
            </div>

            <div className="group text-left bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-green-500/40 transition-all duration-300 animate-slide-up card-hover glow-on-hover" style={{ animationDelay: '0.2s' }}>
              <div className="w-14 h-14 bg-gradient-to-br from-green-600/30 to-green-600/10 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-green-500/10">
                <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-xl mb-3">Sneaker Search</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Search by brand, model, or colorway with smart filters and AI-powered suggestions</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-white/10 mt-auto bg-black/20 backdrop-blur-sm">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500 text-sm">
            © 2025 Driplytics. Sneaker Analytics & Predictions Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Home;

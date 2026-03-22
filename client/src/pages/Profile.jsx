import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { authAPI, favoritesAPI } from '../services/api';

function Profile() {
  const navigate = useNavigate();
  
  const user = (() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  })();

  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [notifications, setNotifications] = useState({
    priceAlerts: true,
    newReleases: true,
    trendingUpdates: false,
    weeklyDigest: true,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [stats, setStats] = useState({
    favorites: 0,
    searches: 0,
    predictions: 0,
    alerts: 0,
    listings: 0,
    messages: 0,
    memberSince: '-',
    daysSinceJoining: 0,
  });
  const [subscription, setSubscription] = useState({ type: 'free', status: 'active', remainingPredictions: 5 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || null);
  const [uploadingPicture, setUploadingPicture] = useState(false);

  // 2FA States
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [setup2FALoading, setSetup2FALoading] = useState(false);
  const [verify2FALoading, setVerify2FALoading] = useState(false);
  const [disable2FALoading, setDisable2FALoading] = useState(false);
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState(['', '', '', '', '', '']);

  // Fetch 2FA status and profile stats on mount
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Fetch 2FA status
        const twoFAResponse = await authAPI.get2FAStatus();
        if (twoFAResponse.success) {
          setTwoFactorEnabled(twoFAResponse.twoFactorEnabled);
        }

        // Fetch profile stats
        const profileResponse = await authAPI.getProfile();
        if (profileResponse.success) {
          if (profileResponse.stats) {
            setStats({
              favorites: profileResponse.stats.favorites || 0,
              searches: profileResponse.stats.searches || 0,
              predictions: profileResponse.stats.predictions || 0,
              alerts: profileResponse.stats.alerts || 0,
              listings: profileResponse.stats.listings || 0,
              messages: profileResponse.stats.messages || 0,
              memberSince: profileResponse.stats.memberSince || '-',
              daysSinceJoining: profileResponse.stats.daysSinceJoining || 0,
            });
          }
          if (profileResponse.subscription) {
            setSubscription(profileResponse.subscription);
          }
          if (profileResponse.recentActivity) {
            setRecentActivity(profileResponse.recentActivity);
          }
        }
        // Update profile picture from server
        if (profileResponse.success && profileResponse.user?.profilePicture) {
          setProfilePicture(profileResponse.user.profilePicture);
          const userData = JSON.parse(localStorage.getItem('user') || '{}');
          userData.profilePicture = profileResponse.user.profilePicture;
          localStorage.setItem('user', JSON.stringify(userData));
        }
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchProfileData();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleNotificationChange = (key) => {
    setNotifications({
      ...notifications,
      [key]: !notifications[key],
    });
  };

  // 2FA Handlers
  const handleVerificationCodeChange = (index, value, codeArray, setCodeArray) => {
    if (value.length > 1) return;
    
    const newCode = [...codeArray];
    newCode[index] = value.replace(/\D/g, '');
    setCodeArray(newCode);

    if (value && index < 5) {
      const nextInput = document.getElementById(`verify-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleVerificationCodeKeyDown = (index, e, codeArray) => {
    if (e.key === 'Backspace' && !codeArray[index] && index > 0) {
      const prevInput = document.getElementById(`verify-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleVerificationCodePaste = (e, setCodeArray) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = ['', '', '', '', '', ''];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pastedData[i] || '';
    }
    setCodeArray(newCode);
  };

  const handleSetup2FA = async () => {
    setSetup2FALoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await authAPI.setup2FA();
      if (response.success) {
        setQrCode(response.qrCode);
        setSecret(response.secret);
        setShowSetup2FA(true);
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to setup 2FA' });
      }
    } catch (error) {
      console.error('2FA setup error:', error);
      setMessage({ type: 'error', text: 'Failed to setup 2FA. Please try again.' });
    } finally {
      setSetup2FALoading(false);
    }
  };

  const handleVerify2FA = async () => {
    const code = verificationCode.join('');
    if (code.length !== 6) {
      setMessage({ type: 'error', text: 'Please enter the complete 6-digit code' });
      return;
    }

    setVerify2FALoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await authAPI.verify2FA(code);
      if (response.success) {
        setTwoFactorEnabled(true);
        setShowSetup2FA(false);
        setVerificationCode(['', '', '', '', '', '']);
        setQrCode('');
        setSecret('');
        setMessage({ type: 'success', text: 'Two-factor authentication enabled successfully!' });
        
        // Update stored user data
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        userData.twoFactorEnabled = true;
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        setMessage({ type: 'error', text: response.message || 'Invalid verification code' });
      }
    } catch (error) {
      console.error('2FA verify error:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Invalid verification code' });
    } finally {
      setVerify2FALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    const code = disableCode.join('');
    if (code.length !== 6) {
      setMessage({ type: 'error', text: 'Please enter the complete 6-digit code' });
      return;
    }

    if (!disablePassword) {
      setMessage({ type: 'error', text: 'Please enter your password' });
      return;
    }

    setDisable2FALoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await authAPI.disable2FA(disablePassword, code);
      if (response.success) {
        setTwoFactorEnabled(false);
        setShowDisable2FA(false);
        setDisablePassword('');
        setDisableCode(['', '', '', '', '', '']);
        setMessage({ type: 'success', text: 'Two-factor authentication disabled successfully' });
        
        // Update stored user data
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        userData.twoFactorEnabled = false;
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to disable 2FA' });
      }
    } catch (error) {
      console.error('2FA disable error:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Invalid password or code' });
    } finally {
      setDisable2FALoading(false);
    }
  };

  const cancelSetup2FA = () => {
    setShowSetup2FA(false);
    setQrCode('');
    setSecret('');
    setVerificationCode(['', '', '', '', '', '']);
  };

  const cancelDisable2FA = () => {
    setShowDisable2FA(false);
    setDisablePassword('');
    setDisableCode(['', '', '', '', '', '']);
  };

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Only image files (jpeg, jpg, png, gif, webp) are allowed' });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size cannot exceed 5MB' });
      return;
    }

    setUploadingPicture(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await authAPI.uploadProfilePicture(file);
      if (response.success) {
        setProfilePicture(response.profilePicture);
        // Update localStorage
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        userData.profilePicture = response.profilePicture;
        localStorage.setItem('user', JSON.stringify(userData));
        setMessage({ type: 'success', text: 'Profile picture updated successfully!' });
      }
    } catch (error) {
      console.error('Profile picture upload error:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to upload profile picture' });
    } finally {
      setUploadingPicture(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleRemoveProfilePicture = async () => {
    setUploadingPicture(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await authAPI.removeProfilePicture();
      if (response.success) {
        setProfilePicture(null);
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        delete userData.profilePicture;
        localStorage.setItem('user', JSON.stringify(userData));
        setMessage({ type: 'success', text: 'Profile picture removed successfully!' });
      }
    } catch (error) {
      console.error('Remove profile picture error:', error);
      setMessage({ type: 'error', text: 'Failed to remove profile picture' });
    } finally {
      setUploadingPicture(false);
    }
  };

  const getProfilePictureUrl = (picturePath) => {
    if (!picturePath) return null;
    const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    return `${API_BASE}${picturePath}`;
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update local storage
      const updatedUser = { ...user, username: formData.username, email: formData.email };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      setLoading(false);
      return;
    }

    if (formData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      setLoading(false);
      return;
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  return (
    <Layout requireAuth adminAllowed>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              {profilePicture ? (
                <img
                  src={getProfilePictureUrl(profilePicture)}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover ring-2 ring-indigo-500/50"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-4xl">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {/* Camera overlay on hover */}
              <label
                htmlFor="profile-picture-input"
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingPicture ? (
                  <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </label>
              <input
                id="profile-picture-input"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleProfilePictureUpload}
                className="hidden"
                disabled={uploadingPicture}
              />
              {/* Remove button */}
              {profilePicture && (
                <button
                  onClick={handleRemoveProfilePicture}
                  disabled={uploadingPicture}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                  title="Remove profile picture"
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-bold text-white mb-1">{user?.username}</h1>
              <p className="text-gray-400">{user?.email}</p>
              <p className="text-gray-500 text-xs mt-1">Hover over picture to change</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
            {[
              { label: 'Searches', value: stats.searches, icon: (
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              ), color: 'from-blue-500/20 to-blue-600/10' },
              { label: 'Predictions', value: stats.predictions, icon: (
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              ), color: 'from-purple-500/20 to-purple-600/10' },
              { label: 'Favorites', value: stats.favorites, icon: (
                <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              ), color: 'from-pink-500/20 to-pink-600/10' },
              { label: 'Member Since', value: stats.memberSince, icon: (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              ), color: 'from-green-500/20 to-green-600/10' },
            ].map((stat, index) => (
              <div key={index} className={`text-center p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                {statsLoading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-white/10 rounded w-12 mx-auto mb-1"></div>
                    <div className="h-4 bg-white/10 rounded w-16 mx-auto"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-1 mb-1">{stat.icon}</div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-gray-400 text-sm">{stat.label}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'profile', label: 'Profile', icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )},
            { id: 'security', label: 'Security', icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )},
            { id: 'activity', label: 'Activity', icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            )},
            { id: 'notifications', label: 'Notifications', icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            )},
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl ${
            message.type === 'success' 
              ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
              : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Profile Settings</h2>
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Two-Factor Authentication Section */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-white">Two-Factor Authentication</h2>
                  <p className="text-gray-400 text-xs sm:text-sm">
                    Add an extra layer of security to your account
                  </p>
                </div>
              </div>

              {!showSetup2FA && !showDisable2FA && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${twoFactorEnabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                    <span className="text-white text-sm sm:text-base">
                      {twoFactorEnabled ? '2FA is enabled' : '2FA is disabled'}
                    </span>
                  </div>
                  {twoFactorEnabled ? (
                    <button
                      onClick={() => setShowDisable2FA(true)}
                      className="w-full sm:w-auto px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-all text-sm font-medium"
                    >
                      Disable 2FA
                    </button>
                  ) : (
                    <button
                      onClick={handleSetup2FA}
                      disabled={setup2FALoading}
                      className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-medium disabled:opacity-50"
                    >
                      {setup2FALoading ? 'Setting up...' : 'Enable 2FA'}
                    </button>
                  )}
                </div>
              )}

              {/* 2FA Setup Modal */}
              {showSetup2FA && (
                <div className="mt-4 p-4 sm:p-6 bg-white/5 rounded-xl border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 text-center sm:text-left">Setup Two-Factor Authentication</h3>
                  
                  <div className="space-y-5">
                    <p className="text-gray-400 text-sm">
                      1. Download an authenticator app like Google Authenticator or Authy
                    </p>
                    
                    <p className="text-gray-400 text-sm">
                      2. Scan the QR code below with your authenticator app:
                    </p>

                    {qrCode && (
                      <div className="flex justify-center p-4 bg-white rounded-xl mx-auto max-w-[220px]">
                        <img src={qrCode} alt="2FA QR Code" className="w-44 h-44 sm:w-48 sm:h-48" />
                      </div>
                    )}

                    <div className="text-center">
                      <p className="text-gray-400 text-xs mb-2">Or enter this code manually:</p>
                      <code className="inline-block px-3 py-2 bg-gray-800 text-indigo-400 rounded-lg text-xs sm:text-sm font-mono break-all max-w-full">
                        {secret}
                      </code>
                    </div>

                    <p className="text-gray-400 text-sm">
                      3. Enter the 6-digit code from your authenticator app:
                    </p>

                    <div className="flex justify-center gap-1.5 sm:gap-2 flex-wrap">
                      {verificationCode.map((digit, index) => (
                        <input
                          key={index}
                          id={`verify-${index}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleVerificationCodeChange(index, e.target.value, verificationCode, setVerificationCode)}
                          onKeyDown={(e) => handleVerificationCodeKeyDown(index, e, verificationCode)}
                          onPaste={(e) => handleVerificationCodePaste(e, setVerificationCode)}
                          className="w-10 h-11 sm:w-11 sm:h-12 text-center text-lg sm:text-xl font-bold border-2 rounded-lg bg-white/5 border-white/20 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        />
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        onClick={cancelSetup2FA}
                        className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleVerify2FA}
                        disabled={verificationCode.join('').length !== 6 || verify2FALoading}
                        className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-medium disabled:opacity-50"
                      >
                        {verify2FALoading ? 'Verifying...' : 'Enable 2FA'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Disable 2FA Modal */}
              {showDisable2FA && (
                <div className="mt-4 p-4 sm:p-6 bg-white/5 rounded-xl border border-red-500/30">
                  <h3 className="text-lg font-semibold text-white mb-4 text-center sm:text-left">Disable Two-Factor Authentication</h3>
                  
                  <div className="space-y-5">
                    <p className="text-gray-400 text-sm">
                      To disable 2FA, please enter your password and current authenticator code:
                    </p>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Password
                      </label>
                      <input
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                        placeholder="Enter your password"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Authenticator Code
                      </label>
                      <div className="flex justify-center gap-1.5 sm:gap-2 flex-wrap">
                        {disableCode.map((digit, index) => (
                          <input
                            key={index}
                            id={`disable-${index}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => {
                              if (e.target.value.length > 1) return;
                              const newCode = [...disableCode];
                              newCode[index] = e.target.value.replace(/\D/g, '');
                              setDisableCode(newCode);
                              if (e.target.value && index < 5) {
                                document.getElementById(`disable-${index + 1}`)?.focus();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !disableCode[index] && index > 0) {
                                document.getElementById(`disable-${index - 1}`)?.focus();
                              }
                            }}
                            className="w-10 h-11 sm:w-11 sm:h-12 text-center text-lg sm:text-xl font-bold border-2 rounded-lg bg-white/5 border-white/20 text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        onClick={cancelDisable2FA}
                        className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDisable2FA}
                        disabled={disableCode.join('').length !== 6 || !disablePassword || disable2FALoading}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-medium disabled:opacity-50"
                      >
                        {disable2FALoading ? 'Disabling...' : 'Disable 2FA'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Change Password Section */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Change Password</h2>
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium disabled:opacity-50"
                >
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl border border-red-500/30 p-6">
              <h2 className="text-xl font-semibold text-red-400 mb-2">Danger Zone</h2>
              <p className="text-gray-400 mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <button
                onClick={handleDeleteAccount}
                className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-medium"
              >
                Delete Account
              </button>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            {/* Detailed Stats Grid */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Your Activity Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Searches', value: stats.searches, icon: '🔍', desc: 'sneakers searched' },
                  { label: 'Predictions', value: stats.predictions, icon: '📊', desc: 'prices predicted' },
                  { label: 'Favorites', value: stats.favorites, icon: '❤️', desc: 'items saved' },
                  { label: 'Alerts', value: stats.alerts, icon: '🔔', desc: 'price alerts set' },
                  { label: 'Listings', value: stats.listings, icon: '🏷️', desc: 'items listed' },
                  { label: 'Messages', value: stats.messages, icon: '💬', desc: 'messages sent' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-white/5 rounded-xl p-4 text-center hover:bg-white/10 transition-all">
                    <span className="text-2xl">{item.icon}</span>
                    {statsLoading ? (
                      <div className="animate-pulse mt-2">
                        <div className="h-7 bg-white/10 rounded w-10 mx-auto mb-1"></div>
                        <div className="h-3 bg-white/10 rounded w-16 mx-auto"></div>
                      </div>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-white mt-1">{item.value}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Subscription & Account Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Subscription</h3>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    subscription.type === 'pro' ? 'bg-yellow-500/20' :
                    subscription.type === 'premium' ? 'bg-indigo-500/20' : 'bg-gray-500/20'
                  }`}>
                    {subscription.type === 'pro' ? (
                      <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-semibold capitalize">{subscription.type} Plan</p>
                    <p className="text-gray-500 text-xs">
                      {subscription.type === 'free'
                        ? `${subscription.remainingPredictions === -1 ? 'Unlimited' : subscription.remainingPredictions} predictions remaining`
                        : `Status: ${subscription.status}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Account Age</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold">{stats.daysSinceJoining} days</p>
                    <p className="text-gray-500 text-xs">Member since {stats.memberSince}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
              {statsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                      <div className="w-8 h-8 bg-white/10 rounded-lg"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-white/10 rounded w-3/4 mb-1"></div>
                        <div className="h-3 bg-white/10 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-400 text-lg font-medium">No activity yet</p>
                  <p className="text-gray-500 text-sm mt-1">Start searching for sneakers or making predictions!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'search' ? 'bg-blue-500/20' : 'bg-purple-500/20'
                      }`}>
                        {activity.type === 'search' ? (
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {activity.type === 'search' ? (
                          <>
                            <p className="text-white text-sm truncate">
                              Searched for <span className="font-medium text-blue-400">"{activity.query}"</span>
                            </p>
                            <p className="text-gray-500 text-xs">
                              {activity.resultCount != null ? `${activity.resultCount} results found` : ''}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-white text-sm truncate">
                              Predicted price for <span className="font-medium text-purple-400">{activity.sneakerName}</span>
                            </p>
                            <p className="text-gray-500 text-xs">
                              ${activity.predictedPrice?.toFixed(0)}
                              {activity.confidence ? ` · ${(activity.confidence * 100).toFixed(0)}% confidence` : ''}
                            </p>
                          </>
                        )}
                      </div>
                      <span className="text-gray-600 text-xs flex-shrink-0">
                        {activity.timestamp ? (() => {
                          const diff = Date.now() - new Date(activity.timestamp).getTime();
                          const mins = Math.floor(diff / 60000);
                          if (mins < 1) return 'just now';
                          if (mins < 60) return `${mins}m ago`;
                          const hrs = Math.floor(mins / 60);
                          if (hrs < 24) return `${hrs}h ago`;
                          const days = Math.floor(hrs / 24);
                          if (days < 7) return `${days}d ago`;
                          return new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        })() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Notification Preferences</h2>
            <div className="space-y-4">
              {[
                { key: 'priceAlerts', label: 'Price Alerts', description: 'Get notified when prices change for your favorites' },
                { key: 'newReleases', label: 'New Releases', description: 'Stay updated on upcoming sneaker releases' },
                { key: 'trendingUpdates', label: 'Trending Updates', description: 'Weekly updates on market trends' },
                { key: 'weeklyDigest', label: 'Weekly Digest', description: 'Summary of your portfolio performance' },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl"
                >
                  <div>
                    <p className="text-white font-medium">{item.label}</p>
                    <p className="text-gray-400 text-sm">{item.description}</p>
                  </div>
                  <button
                    onClick={() => handleNotificationChange(item.key)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      notifications[item.key] ? 'bg-indigo-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        notifications[item.key] ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Profile;

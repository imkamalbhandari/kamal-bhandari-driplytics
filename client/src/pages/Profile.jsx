import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { authAPI } from '../services/api';

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

  // Fetch 2FA status on mount
  useEffect(() => {
    const fetch2FAStatus = async () => {
      try {
        const response = await authAPI.get2FAStatus();
        if (response.success) {
          setTwoFactorEnabled(response.twoFactorEnabled);
        }
      } catch (error) {
        console.error('Failed to fetch 2FA status:', error);
      }
    };
    fetch2FAStatus();
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

  const stats = [
    { label: 'Favorites', value: '24' },
    { label: 'Searches', value: '156' },
    { label: 'Predictions', value: '48' },
    { label: 'Member Since', value: 'Dec 2025' },
  ];

  return (
    <Layout requireAuth>
      <div className="flex-1 w-full">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-4xl">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-bold text-white mb-1">{user?.username}</h1>
              <p className="text-gray-400">{user?.email}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-gray-400 text-sm">{stat.label}</p>
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
      </div>
    </Layout>
  );
}

export default Profile;

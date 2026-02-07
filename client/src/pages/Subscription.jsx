import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { paymentAPI } from '../services/api';

function Subscription() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [plans, setPlans] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState(null);

  // Check for payment verification on page load
  useEffect(() => {
    const pidx = searchParams.get('pidx');
    const txnId = searchParams.get('transaction_id');
    const amount = searchParams.get('amount');
    const purchaseOrderId = searchParams.get('purchase_order_id');

    if (pidx) {
      verifyPayment({ pidx, txnId, amount, purchaseOrderId });
    }
  }, [searchParams]);

  // Fetch plans and status
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansRes, statusRes] = await Promise.all([
          paymentAPI.getPlans(),
          paymentAPI.getStatus()
        ]);
        
        if (plansRes.success) setPlans(plansRes.plans);
        if (statusRes.success) setStatus(statusRes);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const verifyPayment = async (paymentData) => {
    setVerifying(true);
    try {
      const response = await paymentAPI.verifyPayment(paymentData);
      if (response.success) {
        setMessage({
          type: 'success',
          text: `🎉 Payment successful! You now have ${response.subscription.type} access for ${response.subscription.daysRemaining} days.`
        });
        // Refresh status
        const statusRes = await paymentAPI.getStatus();
        if (statusRes.success) setStatus(statusRes);
      } else {
        setMessage({ type: 'error', text: response.error || 'Payment verification failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Payment verification failed. Please contact support.' });
    } finally {
      setVerifying(false);
      // Clear URL params
      navigate('/subscription', { replace: true });
    }
  };

  const handleSubscribe = async (planType) => {
    setProcessingPayment(true);
    setMessage(null);
    
    try {
      const response = await paymentAPI.initiatePayment(planType);
      if (response.success && response.paymentUrl) {
        // Redirect to Khalti payment page
        window.location.href = response.paymentUrl;
      } else {
        setMessage({ type: 'error', text: 'Failed to initiate payment' });
      }
    } catch (error) {
      console.error('Payment error:', error);
      setMessage({ type: 'error', text: 'Failed to initiate payment. Please try again.' });
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading || verifying) {
    return (
      <Layout requireAuth>
        <div className="w-full min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
            <p className="text-gray-400">{verifying ? 'Verifying payment...' : 'Loading...'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Upgrade Your Experience</h1>
          <p className="text-gray-400 text-lg">Get unlimited predictions and premium features</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-8 p-4 rounded-xl ${
            message.type === 'success' 
              ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
              : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}>
            <p>{message.text}</p>
          </div>
        )}

        {/* Current Status */}
        {status && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Your Current Plan</h2>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    status.subscription.type === 'free' 
                      ? 'bg-gray-500/20 text-gray-400' 
                      : status.subscription.type === 'premium'
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {status.subscription.type.toUpperCase()}
                  </span>
                  {status.subscription.isActive && status.subscription.daysRemaining > 0 && (
                    <span className="text-gray-400 text-sm">
                      {status.subscription.daysRemaining} days remaining
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">Predictions Used</p>
                <p className="text-2xl font-bold text-white">
                  {status.predictions.unlimited ? (
                    <span className="text-green-400">Unlimited</span>
                  ) : (
                    <span>
                      {status.predictions.used} / {status.predictions.limit}
                    </span>
                  )}
                </p>
                {!status.predictions.unlimited && status.predictions.remaining <= 2 && (
                  <p className="text-yellow-400 text-sm mt-1">
                    ⚠️ {status.predictions.remaining} predictions left
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Premium Plan */}
          {plans?.premium && (
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-sm rounded-2xl p-8 border border-indigo-500/30 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-indigo-500 text-white text-xs px-3 py-1 rounded-full">
                POPULAR
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{plans.premium.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-white">रू {plans.premium.price}</span>
                <span className="text-gray-400">/ {plans.premium.duration} days</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plans.premium.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-gray-300">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe('premium')}
                disabled={processingPayment || status?.subscription?.type === 'premium'}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {processingPayment ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : status?.subscription?.type === 'premium' ? (
                  'Current Plan'
                ) : (
                  <>
                    <img src="https://khalti.com/static/img/logo.png" alt="Khalti" className="h-5" />
                    Pay with Khalti
                  </>
                )}
              </button>
            </div>
          )}

          {/* Pro Plan */}
          {plans?.pro && (
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/30 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-purple-500 text-white text-xs px-3 py-1 rounded-full">
                BEST VALUE
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{plans.pro.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-white">रू {plans.pro.price}</span>
                <span className="text-gray-400">/ {plans.pro.duration} days</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plans.pro.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-gray-300">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe('pro')}
                disabled={processingPayment || status?.subscription?.type === 'pro'}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {processingPayment ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : status?.subscription?.type === 'pro' ? (
                  'Current Plan'
                ) : (
                  <>
                    <img src="https://khalti.com/static/img/logo.png" alt="Khalti" className="h-5" />
                    Pay with Khalti
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Free Tier Info */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full text-gray-400 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Free tier includes 5 predictions per month
          </div>
        </div>

        {/* Khalti Badge */}
        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <span>Secured by</span>
            <img src="https://khalti.com/static/img/logo.png" alt="Khalti" className="h-6" />
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Subscription;

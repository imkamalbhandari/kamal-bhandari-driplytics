import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { paymentAPI } from '../services/api';

const KHALTI_LOGO = 'https://khalti.com/static/img/logo.png';

function Subscription() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [plans, setPlans] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState(null);

  const paidPlanKey = plans
    ? (plans.basic ? 'basic' : plans.premium ? 'premium' : Object.keys(plans)[0])
    : null;
  const paidPlan = paidPlanKey ? plans?.[paidPlanKey] : null;
  const hasActivePaidPlan = !!(status?.subscription?.isActive && status?.subscription?.type !== 'free');

  // Khalti redirect callback: return_url receives ?pidx=...&transaction_id=...&status=... etc.
  useEffect(() => {
    const pidx = searchParams.get('pidx');
    const txnId = searchParams.get('transaction_id') || searchParams.get('txnId');
    const amount = searchParams.get('amount');
    const totalAmount = searchParams.get('total_amount');
    const purchaseOrderId = searchParams.get('purchase_order_id');
    const status = searchParams.get('status');

    if (pidx) {
      verifyPayment({ pidx, txnId, amount: amount || totalAmount, purchaseOrderId, status });
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
          text: `Payment successful! You now have ${response.subscription.type} access for ${response.subscription.daysRemaining} days.`
        });
        const statusRes = await paymentAPI.getStatus();
        if (statusRes.success) setStatus(statusRes);
      } else {
        setMessage({ type: 'error', text: response.error || 'Payment verification failed' });
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Payment verification failed. Please contact support.';
      setMessage({ type: 'error', text: msg });
    } finally {
      setVerifying(false);
      navigate('/subscription', { replace: true });
    }
  };

  const handleSubscribe = async (planType) => {
    setProcessingPayment(true);
    setMessage(null);

    try {
      const response = await paymentAPI.initiatePayment(planType);
      if (response.success && response.paymentUrl) {
        window.location.href = response.paymentUrl;
      } else {
        setMessage({ type: 'error', text: 'Failed to initiate payment' });
      }
    } catch (error) {
      console.error('Payment error:', error);
      const backendMessage =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        error.message ||
        'Failed to initiate payment. Please try again.';
      setMessage({ type: 'error', text: backendMessage });
    } finally {
      setProcessingPayment(false);
    }
  };

  // ——— Verifying payment (full-screen modern state) ———
  if (verifying) {
    return (
      <Layout requireAuth>
        <div className="min-h-[80vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md animate-fade-in">
            <div className="relative inline-flex items-center justify-center w-24 h-24 mb-8">
              <div className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping" />
              <div className="relative rounded-full bg-gradient-to-br from-violet-500 to-purple-700 p-1 shadow-lg shadow-violet-500/30">
                <div className="rounded-full bg-gray-900 w-full h-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Confirming your payment</h2>
            <p className="text-gray-400">Please wait while we verify with Khalti…</p>
            <div className="mt-8 flex items-center justify-center gap-2 text-gray-500 text-sm">
              <img src={KHALTI_LOGO} alt="Khalti" className="h-5 opacity-80" />
              <span>Secured by Khalti</span>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ——— Loading plans ———
  if (loading) {
    return (
      <Layout requireAuth>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 mb-4">
              <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
            </div>
            <p className="text-gray-400">Loading plans…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth>
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {/* Page header */}
        <header className="text-center mb-12 animate-fade-in">
          <p className="text-violet-400 text-sm font-medium uppercase tracking-wider mb-2">Subscription</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            Upgrade your experience
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Get unlimited predictions and paid features. Pay securely with Khalti.
          </p>
        </header>

        {/* Success / Error message */}
        {message && (
          <div
            className={`mb-8 rounded-2xl border p-5 flex items-start gap-4 animate-slide-up ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            {message.type === 'success' ? (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
            <p className={message.type === 'success' ? 'text-emerald-200' : 'text-red-200'}>{message.text}</p>
          </div>
        )}

        {/* Current plan status */}
        {status && (
          <section className="mb-10 animate-fade-in" style={{ animationDelay: '0.05s' }}>
            <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Your plan</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold ${
                        status.subscription.type === 'free'
                          ? 'bg-gray-500/20 text-gray-300'
                          : 'bg-violet-500/20 text-violet-300'
                      }`}
                    >
                      {status.subscription.type === 'free' && (
                        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {status.subscription.type.toUpperCase()}
                    </span>
                    {status.subscription.isActive && status.subscription.daysRemaining > 0 && (
                      <span className="text-gray-400 text-sm">
                        {status.subscription.daysRemaining} days remaining
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-gray-400 text-sm mb-1">Predictions</p>
                  <p className="text-2xl font-bold text-white">
                    {status.predictions.unlimited ? (
                      <span className="text-emerald-400">Unlimited</span>
                    ) : (
                      <span>
                        {status.predictions.used} <span className="text-gray-500">/</span> {status.predictions.limit}
                      </span>
                    )}
                  </p>
                  {!status.predictions.unlimited && status.predictions.remaining <= 2 && status.predictions.remaining >= 0 && (
                    <p className="text-amber-400 text-sm mt-1">{status.predictions.remaining} left this month</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Pricing card */}
        <div className="max-w-2xl mx-auto">
          {paidPlan && (
            <article className="group relative bg-gradient-to-b from-white/[0.06] to-transparent backdrop-blur-sm rounded-3xl p-8 border border-white/10 hover:border-violet-500/40 transition-all duration-300 animate-fade-in">
              <div className="absolute top-5 right-5">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/30 text-violet-300 border border-violet-500/30">
                  Popular
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">{paidPlan.name}</h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-white">रू {paidPlan.price}</span>
                <span className="text-gray-500">/ {paidPlan.duration} days</span>
              </div>
              <ul className="space-y-4 mb-8">
                {paidPlan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(paidPlanKey)}
                disabled={processingPayment || hasActivePaidPlan}
                className="w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
              >
                {processingPayment ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : hasActivePaidPlan ? (
                  'Current plan'
                ) : (
                  <>
                    <img src={KHALTI_LOGO} alt="" className="h-5 w-auto" />
                    Pay with Khalti
                  </>
                )}
              </button>
            </article>
          )}

          {!paidPlan && (
            <div className="text-center py-10 text-gray-500 text-sm">No paid plan is available right now.</div>
          )}

        </div>

        {/* Free tier note */}
        <p className="mt-10 text-center text-gray-500 text-sm">
          Free tier includes 5 predictions per month. Upgrade for unlimited access.
        </p>

        {/* Khalti trust badge */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/5 text-gray-500 text-sm">
            <span>Secured by</span>
            <img src={KHALTI_LOGO} alt="Khalti" className="h-5" />
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Subscription;

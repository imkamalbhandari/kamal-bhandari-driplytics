import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeftRight,
  Bell,
  ChevronDown,
  CreditCard,
  Heart,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Scale,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react';
import { paymentAPI } from '../../services/api';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(null);
  const profileRef = useRef(null);

  const user = (() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  })();

  const isFreeUser = user && !user.isAdmin && hasActiveSubscription === false;

  const deriveActiveSubscriptionFromUser = (localUser) => {
    if (!localUser || localUser.isAdmin) return false;

    const subscription = localUser.subscription;
    if (!subscription) return false;

    const subscriptionType = typeof subscription === 'string' ? subscription : subscription.type;
    if (!subscriptionType || subscriptionType === 'free') return false;

    if (typeof subscription === 'object') {
      if (subscription.status && subscription.status !== 'active') return false;
      if (subscription.endDate && new Date(subscription.endDate) <= new Date()) return false;
    }

    return true;
  };

  const getProfilePictureUrl = (picturePath) => {
    if (!picturePath) return null;
    const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    return `${API_BASE}${picturePath}`;
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;

    const syncSubscriptionStatus = async () => {
      if (!user || user.isAdmin) {
        if (isMounted) setHasActiveSubscription(null);
        return;
      }

      const fallbackActiveStatus = deriveActiveSubscriptionFromUser(user);

      try {
        const statusRes = await paymentAPI.getStatus();
        const serverHasActiveSubscription =
          statusRes?.success &&
          statusRes?.subscription?.isActive &&
          statusRes?.subscription?.type !== 'free';

        if (isMounted) {
          setHasActiveSubscription(Boolean(serverHasActiveSubscription));
        }
      } catch {
        if (isMounted) {
          setHasActiveSubscription(fallbackActiveStatus);
        }
      }
    };

    syncSubscriptionStatus();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.isAdmin]);

  const handleLogoutClick = () => {
    setProfileOpen(false);
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setShowLogoutConfirm(false);
    sessionStorage.setItem('logoutSuccess', 'true');
    navigate('/');
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirm(false);
  };

  const navLinks = user?.isAdmin
    ? [{ path: '/admin', label: 'Admin Panel', icon: Shield }]
    : [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
        { path: '/search', label: 'Search', icon: Search },
        { path: '/trends', label: 'Prediction', icon: TrendingUp },
        { path: '/compare', label: 'Compare', icon: Scale },
        { path: '/favorites', label: 'Favorites', icon: Heart },
        { path: '/trade', label: 'Trade', icon: ArrowLeftRight },
        { path: '/chat', label: 'Chat', icon: MessageSquare },
        { path: '/alerts', label: 'Alerts', icon: Bell },
      ];

  const isLinkActive = (link) => location.pathname === link.path;

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto h-[52px] w-full max-w-[1440px] px-6 max-md:px-4">
        <div className="flex h-full items-center justify-between gap-4">
          <Link
            to={user?.isAdmin ? '/admin' : user ? '/dashboard' : '/'}
            className="inline-flex items-center gap-2 text-[var(--color-text-primary)]"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] font-[var(--font-display)] text-[var(--text-base)] font-[var(--weight-bold)] text-[var(--color-accent)]">
              D
            </span>
            <span className="font-[var(--font-display)] text-[var(--text-md)] font-[var(--weight-bold)] tracking-[var(--tracking-tight)]">
              Driplytics
            </span>
          </Link>

          {user && (
            <div className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isLinkActive(link);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`relative inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] transition-colors duration-100 ${
                      active
                        ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {active && (
                      <span className="absolute bottom-1 left-0 top-1 w-[2px] rounded-r-sm bg-[var(--color-accent)]" />
                    )}
                    <Icon size={16} strokeWidth={1.5} className="shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {isFreeUser && (
                  <Link
                    to="/subscription"
                    className="hidden items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-accent-dim)] bg-[var(--color-accent-bg)] px-3 py-2 text-[var(--text-xs)] font-[var(--weight-medium)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-accent)] sm:inline-flex"
                  >
                    <Sparkles size={16} strokeWidth={1.5} />
                    Upgrade
                  </Link>
                )}

                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className={`inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-1.5 py-1 transition-colors duration-100 ${
                      profileOpen || location.pathname === '/profile'
                        ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-2)]'
                        : 'border-[var(--color-border)] bg-transparent hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    {user.profilePicture ? (
                      <img
                        src={getProfilePictureUrl(user.profilePicture)}
                        alt={user.username}
                        className="h-7 w-7 rounded-[var(--radius-md)] object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] font-[var(--font-display)] text-[var(--text-sm)] text-[var(--color-accent)]">
                        {user.username?.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <ChevronDown
                      size={14}
                      strokeWidth={1.5}
                      className={`hidden text-[var(--color-text-secondary)] transition-transform sm:block ${profileOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                      <div className="border-b border-[var(--color-border)] p-4">
                        <div className="flex items-center gap-3">
                          {user.profilePicture ? (
                            <img
                              src={getProfilePictureUrl(user.profilePicture)}
                              alt=""
                              className="h-10 w-10 rounded-[var(--radius-md)] object-cover"
                            />
                          ) : (
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] font-[var(--font-display)] text-[var(--color-accent)]">
                              {user.username?.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-text-primary)]">
                              {user.username}
                            </p>
                            <p className="truncate text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                              {user.email || 'Sneaker Enthusiast'}
                            </p>
                          </div>
                        </div>

                        {isFreeUser && (
                          <Link
                            to="/subscription"
                            onClick={() => setProfileOpen(false)}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-accent-dim)] bg-[var(--color-accent)] px-3 py-2 text-[var(--text-xs)] font-[var(--weight-medium)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-bg)]"
                          >
                            <Sparkles size={14} strokeWidth={1.5} />
                            Upgrade Plan
                          </Link>
                        )}
                      </div>

                      <div className="p-1.5">
                        <Link
                          to="/profile"
                          onClick={() => setProfileOpen(false)}
                          className="inline-flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                        >
                          <UserRound size={16} strokeWidth={1.5} />
                          Profile & Settings
                        </Link>
                        <Link
                          to="/subscription"
                          onClick={() => setProfileOpen(false)}
                          className="inline-flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                        >
                          <CreditCard size={16} strokeWidth={1.5} />
                          Subscription
                        </Link>
                        <div className="my-1 h-px bg-[var(--color-border)]" />
                        <button
                          onClick={handleLogoutClick}
                          className="inline-flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left text-[var(--text-sm)] text-[var(--color-down)] transition-colors hover:bg-[var(--color-surface-2)]"
                        >
                          <LogOut size={16} strokeWidth={1.5} />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] p-2 text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] lg:hidden"
                >
                  {mobileMenuOpen ? (
                    <X size={18} strokeWidth={1.5} />
                  ) : (
                    <Menu size={18} strokeWidth={1.5} />
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-bg)]"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>

        {user && mobileMenuOpen && (
          <div className="border-t border-[var(--color-border)] py-2 lg:hidden">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isLinkActive(link);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`relative mt-1 inline-flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-3 text-[var(--text-sm)] ${
                    active
                      ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {active && (
                    <span className="absolute bottom-1 left-0 top-1 w-[2px] rounded-r-sm bg-[var(--color-accent)]" />
                  )}
                  <Icon size={16} strokeWidth={1.5} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-bg)]/80 p-4">
          <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="text-center">
              <div className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-down)]">
                <LogOut size={20} strokeWidth={1.5} />
              </div>
              <h3 className="font-[var(--font-display)] text-[var(--text-lg)] font-[var(--weight-bold)] text-[var(--color-text-primary)]">
                Confirm Logout
              </h3>
              <p className="mt-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                Are you sure you want to logout?
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={handleLogoutCancel}
                  className="inline-flex flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-text-secondary)]"
                >
                  Stay
                </button>
                <button
                  onClick={handleLogoutConfirm}
                  className="inline-flex flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-down)] px-3 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-down)]"
                >
                  Logout
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

import { Link } from 'react-router-dom';
import { Globe, Globe2, ShieldCheck } from 'lucide-react';

function Footer() {
  return (
    <footer className="w-full border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-10 max-md:px-4">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="mb-4 inline-flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] font-[var(--font-display)] text-[var(--text-base)] font-[var(--weight-bold)] text-[var(--color-accent)]">
                D
              </span>
              <span className="font-[var(--font-display)] text-[var(--text-lg)] font-[var(--weight-bold)] tracking-[var(--tracking-tight)] text-[var(--color-text-primary)]">
                Driplytics
              </span>
            </Link>
            <p className="max-w-md text-[var(--text-sm)] leading-[var(--leading-normal)] text-[var(--color-text-secondary)]">
              AI-powered sneaker analytics and price predictions. Make smarter buying and selling decisions with real-time market data.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a
                href="#"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
                aria-label="Website"
              >
                <Globe size={16} strokeWidth={1.5} />
              </a>
              <a
                href="#"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
                aria-label="GitHub"
              >
                <Globe2 size={16} strokeWidth={1.5} />
              </a>
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-[var(--font-body)] text-[var(--text-xs)] font-[var(--weight-medium)] uppercase tracking-[var(--tracking-wider)] text-[var(--color-text-secondary)]">
              Quick Links
            </h3>
            <ul className="space-y-1.5">
              <li><Link to="/dashboard" className="inline-flex min-h-8 items-center text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">Dashboard</Link></li>
              <li><Link to="/search" className="inline-flex min-h-8 items-center text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">Search Sneakers</Link></li>
              <li><Link to="/trends" className="inline-flex min-h-8 items-center text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">Market Trends</Link></li>
              <li><Link to="/favorites" className="inline-flex min-h-8 items-center text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">Favorites</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 font-[var(--font-body)] text-[var(--text-xs)] font-[var(--weight-medium)] uppercase tracking-[var(--tracking-wider)] text-[var(--color-text-secondary)]">
              Account
            </h3>
            <ul className="space-y-1.5">
              <li><Link to="/profile" className="inline-flex min-h-8 items-center text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">Profile Settings</Link></li>
              <li><Link to="/login" className="inline-flex min-h-8 items-center text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">Login</Link></li>
              <li><Link to="/signup" className="inline-flex min-h-8 items-center text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">Sign Up</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--color-border)] pt-5">
          <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
              © 2025 Driplytics. All rights reserved.
            </p>
            <p className="inline-flex items-center gap-2 text-[var(--text-xs)] text-[var(--color-text-secondary)]">
              <ShieldCheck size={16} strokeWidth={1.5} className="text-[var(--color-up)]" />
              Secured with industry-standard encryption
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

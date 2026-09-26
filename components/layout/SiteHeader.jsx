'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/AuthProvider';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/releases', label: 'Releases' },
  { href: '/publishing', label: 'Publishing' },
  { href: '/marketing', label: 'Marketing' },
  { href: '/analytics', label: 'Analytics' },
];

function Wordmark() {
  return (
    <span className="wordmark">
      <svg
        className="wordmark__mark"
        viewBox="0 0 48 24"
        width="40"
        height="20"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <g fill="currentColor">
          <rect x="0" y="9" width="4" height="6" rx="2" />
          <rect x="7" y="5" width="4" height="14" rx="2" />
          <rect x="14" y="1" width="4" height="22" rx="2" />
          <rect x="21" y="6" width="4" height="12" rx="2" />
          <rect x="28" y="2" width="4" height="20" rx="2" />
          <rect x="35" y="7" width="4" height="10" rx="2" />
          <rect x="42" y="10" width="4" height="4" rx="2" />
        </g>
      </svg>
      <span className="wordmark__text">ClaudeSounds</span>
    </span>
  );
}

export default function SiteHeader() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      // Even if the API is unreachable we still send the user home.
      if (typeof console !== 'undefined') {
        console.warn('Logout failed:', err && err.message ? err.message : err);
      }
    } finally {
      setLoggingOut(false);
      setMenuOpen(false);
      router.push('/');
    }
  }

  const authArea = (() => {
    if (status === 'loading') {
      return (
        <div className="site-header__auth-loading">
          <Spinner size="sm" label="Checking your session" />
        </div>
      );
    }
    if (status === 'authenticated' && user) {
      return (
        <div className="site-header__account cluster">
          <span className="site-header__artist" title={user.artistName || user.displayName}>
            {user.artistName || user.displayName || user.email}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            loading={loggingOut}
          >
            Log out
          </Button>
        </div>
      );
    }
    return (
      <div className="cluster">
        <Button as="link" href="/login" variant="ghost" size="sm">
          Log in
        </Button>
        <Button as="link" href="/signup" variant="primary" size="sm">
          Get started
        </Button>
      </div>
    );
  })();

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="site-header__brand" aria-label="ClaudeSounds home">
          <Wordmark />
        </Link>

        <nav className="site-header__nav" aria-label="Primary">
          <ul className="site-header__nav-list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={
                    isActive(link.href)
                      ? 'site-header__link site-header__link--active'
                      : 'site-header__link'
                  }
                  aria-current={isActive(link.href) ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__auth">{authArea}</div>

        <button
          type="button"
          className="site-header__toggle"
          aria-expanded={menuOpen}
          aria-controls="site-mobile-menu"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            {menuOpen ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </g>
            )}
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <div
          className="site-header__mobile-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div
        id="site-mobile-menu"
        className={menuOpen ? 'site-header__mobile is-open' : 'site-header__mobile'}
        hidden={!menuOpen}
      >
        <nav aria-label="Mobile">
          <ul className="site-header__mobile-list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={
                    isActive(link.href)
                      ? 'site-header__mobile-link site-header__mobile-link--active'
                      : 'site-header__mobile-link'
                  }
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__mobile-auth">{authArea}</div>
      </div>
    </header>
  );
}
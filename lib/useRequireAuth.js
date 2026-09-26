'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from './AuthProvider';

/**
 * Client hook for protected pages.
 *
 * Reads the auth context and, once the status resolves to 'anonymous',
 * redirects the visitor to /login?next=<current path> so they can come
 * straight back after signing in.
 *
 * Returns { user, status } so pages can render a full-page Spinner while
 * status === 'loading'.
 */
export default function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  let auth;
  try {
    auth = useAuth();
  } catch (err) {
    // AuthProvider missing — fail soft rather than crashing the page tree.
    auth = { user: null, status: 'loading', error: err };
  }

  const { user, status, error } = auth || {};

  useEffect(() => {
    if (status !== 'anonymous') return;

    let next = pathname || '/dashboard';
    try {
      const qs = searchParams ? searchParams.toString() : '';
      if (qs) next = `${next}?${qs}`;
    } catch (_err) {
      // Ignore — fall back to the bare pathname.
    }

    const target = `/login?next=${encodeURIComponent(next)}`;

    try {
      router.replace(target);
    } catch (_err) {
      if (typeof window !== 'undefined') {
        window.location.href = target;
      }
    }
  }, [status, pathname, searchParams, router]);

  return { user: user || null, status: status || 'loading', error: error || null };
}

export { useRequireAuth };
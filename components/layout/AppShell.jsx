'use client';

import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

export default function AppShell({ children }) {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main id="main-content" className="container app-main">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
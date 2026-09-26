import Link from 'next/link';

const FOOTER_SECTIONS = [
  {
    heading: 'Platform',
    links: [
      { label: 'Releases', href: '/releases' },
      { label: 'Publishing', href: '/publishing' },
      { label: 'Marketing', href: '/marketing' },
      { label: 'Analytics', href: '/analytics' }
    ]
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Release checklist', href: '/releases/new' },
      { label: 'Royalty statements', href: '/analytics' },
      { label: 'Split registration guide', href: '/publishing' },
      { label: 'Create an account', href: '/signup' }
    ]
  },
  {
    heading: 'Company',
    links: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Log in', href: '/login' },
      { label: 'Artist stories', href: '/' },
      { label: 'Pricing', href: '/' }
    ]
  }
];

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__grid">
          <div className="site-footer__brand stack">
            <span className="site-footer__wordmark">ClaudeSounds</span>
            <p className="site-footer__blurb">
              Distribution, publishing administration and campaign tooling for independent
              artists and labels — one catalogue, every store, royalties you can actually read.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav
              key={section.heading}
              className="site-footer__col"
              aria-label={section.heading}
            >
              <h2 className="site-footer__heading">{section.heading}</h2>
              <ul className="site-footer__links">
                {section.links.map((link) => (
                  <li key={`${section.heading}-${link.label}`}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="site-footer__bottom">
          <p className="site-footer__copyright">
            © {year} ClaudeSounds. Royalties reported in USD and paid monthly.
          </p>
          <p className="site-footer__legal">
            Delivering to Spotify, Apple Music, Amazon Music, YouTube Music, Deezer and Tidal.
          </p>
        </div>
      </div>
    </footer>
  );
}
import Card, { CardHeader, CardBody, CardFooter } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

export const metadata = {
  title: 'ClaudeSounds — Distribution, Publishing & Marketing for independent artists',
  description:
    'Deliver your releases to every major streaming store, register publishing splits with collection societies and run marketing campaigns from one dashboard.',
};

const STORES = [
  'Spotify',
  'Apple Music',
  'Amazon Music',
  'YouTube Music',
  'Deezer',
  'Tidal',
];

const FEATURES = [
  {
    title: 'Distribution',
    badge: 'Stores',
    copy: 'Upload a single, EP or album once and deliver it to six major streaming stores with UPCs, ISRCs and release-day scheduling handled for you.',
    points: ['Automatic UPC & ISRC assignment', 'Release-day scheduling', 'Per-store delivery tracking'],
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="0.9" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: 'Publishing',
    badge: 'Royalties',
    copy: 'Register works, split writer shares to the decimal and push registrations to PRS, ASCAP, BMI and GEMA so mechanical income never goes unclaimed.',
    points: ['Split sheets that must total 100%', 'ISWC and society tracking', 'Registration status per work'],
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
        <path
          d="M9 18V6.5l9-1.8V16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="7" cy="18" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="16" cy="16" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: 'Marketing',
    badge: 'Growth',
    copy: 'Plan playlist pitches, social ad flights, PR pushes and influencer drops against a budget, then measure clicks, impressions and cost per stream.',
    points: ['Budget vs spend tracking', 'Channel-level CTR', 'Campaigns linked to releases'],
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
        <path
          d="M4 10v4h3l6 4V6l-6 4H4z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M17 9.2a4 4 0 0 1 0 5.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M19.4 6.6a7.5 7.5 0 0 1 0 10.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Upload your release',
    copy: 'Add artwork colour, track titles, songwriters and explicit flags. Drafts save as you go, so a 14-track album is not a single sitting.',
  },
  {
    n: '02',
    title: 'Deliver to stores',
    copy: 'One click queues Spotify, Apple Music, Amazon Music, YouTube Music, Deezer and Tidal. Watch each delivery move from pending to live.',
  },
  {
    n: '03',
    title: 'Register the publishing',
    copy: 'Create a work for each song, add writer and publisher splits totalling 100%, then submit to your society for mechanical collection.',
  },
  {
    n: '04',
    title: 'Market and measure',
    copy: 'Launch campaigns against a budget and watch daily streams, listeners and estimated revenue land in your analytics dashboard.',
  },
];

const TIERS = [
  {
    name: 'Indie',
    price: '$0',
    cadence: 'per release, 15% revenue share',
    blurb: 'For artists putting out their first few singles.',
    features: [
      'Unlimited singles and EPs',
      'Delivery to all six stores',
      '30-day stream analytics',
      'Basic publishing registration',
    ],
    cta: 'Start distributing',
    href: '/signup',
    variant: 'secondary',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$29',
    cadence: 'per year, keep 100% of royalties',
    blurb: 'For working artists releasing on a schedule.',
    features: [
      'Everything in Indie',
      'Keep 100% of streaming revenue',
      '90-day analytics and top-release breakdown',
      'Marketing campaigns with budget tracking',
      'Royalty statements every month',
    ],
    cta: 'Go Pro',
    href: '/signup',
    variant: 'primary',
    featured: true,
  },
  {
    name: 'Label',
    price: '$99',
    cadence: 'per year, unlimited artists',
    blurb: 'For labels and management running a roster.',
    features: [
      'Everything in Pro',
      'Unlimited artist profiles',
      'Catalogue-wide publishing splits',
      'Consolidated royalty statements',
      'Priority store escalation',
    ],
    cta: 'Talk to us',
    href: '/signup',
    variant: 'secondary',
    featured: false,
  },
];

export default function HomePage() {
  return (
    <div className="stack landing">
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero__copy stack">
          <Badge tone="accent">Distribution · Publishing · Marketing</Badge>
          <h1 id="hero-heading">Release it, register it, then actually get it heard.</h1>
          <p className="hero__sub">
            ClaudeSounds puts streaming delivery, publishing splits and campaign budgets in one
            dashboard — so independent artists and small labels stop stitching together four tools
            and a spreadsheet.
          </p>
          <div className="cluster">
            <Button href="/signup" size="lg" variant="primary">
              Start distributing
            </Button>
            <Button href="#how-it-works" size="lg" variant="ghost">
              See how it works
            </Button>
          </div>
          <p className="hero__note">
            No card needed to build a draft release. Deliver when the masters are ready.
          </p>
        </div>

        <div className="hero__art" aria-hidden="true">
          <div className="art-tile art-tile--1" />
          <div className="art-tile art-tile--2" />
          <div className="art-tile art-tile--3" />
          <div className="art-tile art-tile--4" />
        </div>
      </section>

      <section aria-labelledby="stores-heading" className="stores">
        <h2 id="stores-heading" className="stores__title">
          Delivered to the stores that matter
        </h2>
        <ul className="chip-list" role="list">
          {STORES.map((store) => (
            <li key={store} className="chip">
              {store}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading">Three jobs, one platform</h2>
        <p className="section-lede">
          Most tools solve one slice of a release. ClaudeSounds covers the whole lifecycle, from the
          first upload to the royalty statement.
        </p>
        <div className="grid grid--3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} raised>
              <CardBody>
                <div className="feature">
                  <span className="feature__icon">{feature.icon}</span>
                  <div className="feature__head cluster">
                    <h3>{feature.title}</h3>
                    <Badge tone="neutral">{feature.badge}</Badge>
                  </div>
                  <p>{feature.copy}</p>
                  <ul className="tick-list">
                    {feature.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>
        <p className="section-lede">
          Four steps from finished master to first royalty statement — the same flow whether you are
          shipping one single or a twelve-track album.
        </p>
        <ol className="steps" role="list">
          {STEPS.map((step) => (
            <li key={step.n} className="step">
              <span className="step__n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="pricing-heading">
        <h2 id="pricing-heading">Straightforward pricing</h2>
        <p className="section-lede">
          Every plan includes delivery to all six stores and unlimited publishing works. Upgrade when
          you want to keep the full royalty.
        </p>
        <div className="grid grid--3">
          {TIERS.map((tier) => (
            <Card key={tier.name} raised={tier.featured} className={tier.featured ? 'tier tier--featured' : 'tier'}>
              <CardHeader
                title={tier.name}
                subtitle={tier.blurb}
                actions={tier.featured ? <Badge tone="accent">Most popular</Badge> : null}
              />
              <CardBody>
                <div className="tier__price">
                  <span className="tier__amount">{tier.price}</span>
                  <span className="tier__cadence">{tier.cadence}</span>
                </div>
                <ul className="tick-list">
                  {tier.features.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardBody>
              <CardFooter>
                <Button href={tier.href} variant={tier.variant} size="md" className="btn--block">
                  {tier.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="cta-heading" className="cta">
        <h2 id="cta-heading">Your next release deserves a proper launch</h2>
        <p className="section-lede">
          Create an account, build the release draft tonight, deliver it when the masters land — and
          keep the publishing paperwork in the same place.
        </p>
        <div className="cluster">
          <Button href="/signup" size="lg" variant="primary">
            Create your account
          </Button>
          <Button href="/login" size="lg" variant="ghost">
            Log in
          </Button>
        </div>
      </section>
    </div>
  );
}
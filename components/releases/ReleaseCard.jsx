'use client';

import Link from 'next/link';
import Card from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import Button from '../ui/Button';
import { formatDate, formatNumber, titleCaseStatus } from '../../lib/format';

const ACCENT_TOKENS = {
  amber: 'var(--accent)',
  violet: 'var(--accent-hover)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  neutral: 'var(--surface-raised)',
};

function resolveArtworkColor(value) {
  if (!value) return 'var(--accent)';
  const key = String(value).trim().toLowerCase();
  if (ACCENT_TOKENS[key]) return ACCENT_TOKENS[key];
  if (key.startsWith('--')) return `var(${key})`;
  if (/^#[0-9a-f]{3,8}$/i.test(key)) return key;
  return 'var(--accent)';
}

export default function ReleaseCard({ release }) {
  if (!release) return null;

  const {
    id,
    title,
    artist_name: artistName,
    release_type: releaseType,
    primary_genre: primaryGenre,
    release_date: releaseDate,
    status,
    artwork_color: artworkColor,
    track_count: trackCount,
  } = release;

  const artwork = resolveArtworkColor(artworkColor);
  const trackLabel =
    typeof trackCount === 'number'
      ? `${formatNumber(trackCount)} ${trackCount === 1 ? 'track' : 'tracks'}`
      : 'Tracks pending';

  return (
    <Card className="release-card" padded={false}>
      <div
        className="release-card__artwork"
        style={{ '--artwork-color': artwork }}
        aria-hidden="true"
      >
        <span className="release-card__artwork-mark">
          <svg viewBox="0 0 48 48" width="40" height="40" focusable="false" aria-hidden="true">
            <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.7" />
            <circle cx="24" cy="24" r="5" fill="currentColor" opacity="0.9" />
            <path
              d="M10 30c3-8 6-12 9-12s5 5 8 5 5-4 11-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>
        </span>
      </div>

      <div className="release-card__body stack">
        <div className="release-card__heading">
          <h3 className="release-title">
            <Link href={`/releases/${id}`}>{title || 'Untitled release'}</Link>
          </h3>
          <p className="release-card__artist truncate">{artistName || 'Unknown artist'}</p>
        </div>

        <div className="cluster release-card__meta">
          <StatusBadge status={status} />
          <span className="release-card__meta-item">{titleCaseStatus(releaseType || 'single')}</span>
          {primaryGenre ? (
            <span className="release-card__meta-item">{primaryGenre}</span>
          ) : null}
        </div>

        <dl className="release-card__facts">
          <div className="release-card__fact">
            <dt>Tracks</dt>
            <dd className="num">{trackLabel}</dd>
          </div>
          <div className="release-card__fact">
            <dt>Release date</dt>
            <dd className="num">{releaseDate ? formatDate(releaseDate) : 'Not scheduled'}</dd>
          </div>
        </dl>

        <div className="release-card__actions">
          <Button as="link" href={`/releases/${id}`} variant="secondary" size="sm">
            View release
          </Button>
        </div>
      </div>
    </Card>
  );
}
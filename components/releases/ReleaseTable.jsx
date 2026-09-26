'use client';

import Table from '../ui/Table';
import Badge, { StatusBadge } from '../ui/Badge';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';

const TYPE_LABELS = {
  single: 'Single',
  ep: 'EP',
  album: 'Album',
};

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function artworkStyleClass(color) {
  // artwork_color is stored as a hex-ish string; it is user data, so fall back to
  // the token-driven default gradient class when it is missing or malformed.
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  return /^#?[0-9a-fA-F]{6}$/.test(trimmed)
    ? trimmed.startsWith('#')
      ? trimmed
      : `#${trimmed}`
    : null;
}

function Artwork({ release }) {
  const hex = artworkStyleClass(release && release.artwork_color);
  const label = `${release && release.title ? release.title : 'Untitled'} artwork`;

  if (!hex) {
    return <span className="release-art release-art--default" role="img" aria-label={label} />;
  }

  return (
    <span
      className="release-art"
      role="img"
      aria-label={label}
      // Single documented exception: the gradient seed comes from per-row database
      // data, so it cannot live in the stylesheet. All sizing/shape is in globals.css.
      style={{ '--release-art-seed': hex }}
    />
  );
}

export default function ReleaseTable({
  releases,
  loading = false,
  error = null,
  onSelect,
  onRetry,
}) {
  if (loading) {
    return (
      <div className="table-skeleton" aria-busy="true">
        <div className="cluster cluster--center">
          <Spinner size="md" label="Loading releases" />
          <p className="text-muted">Loading your catalogue…</p>
        </div>
        <div className="skeleton-rows">
          <span className="skeleton-row" />
          <span className="skeleton-row" />
          <span className="skeleton-row" />
          <span className="skeleton-row" />
          <span className="skeleton-row" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        tone="error"
        title="We couldn’t load your releases"
        description={
          typeof error === 'string'
            ? error
            : error.message || 'The ClaudeSounds API is unreachable right now.'
        }
        action={
          onRetry ? (
            <Button variant="primary" size="md" onClick={onRetry}>
              Try again
            </Button>
          ) : null
        }
      />
    );
  }

  const rows = Array.isArray(releases) ? releases : [];

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No releases yet"
        description="Upload your first single and we’ll deliver it to Spotify, Apple Music, Amazon, YouTube Music, Deezer and TIDAL."
        action={
          <Button as="link" href="/releases/new" variant="primary" size="md">
            New release
          </Button>
        }
      />
    );
  }

  const columns = [
    {
      key: 'artwork',
      label: 'Artwork',
      align: 'left',
      render: (release) => <Artwork release={release} />,
    },
    {
      key: 'title',
      label: 'Release',
      align: 'left',
      render: (release) => (
        <span className="release-name">
          <span className="release-name__title">{release.title || 'Untitled release'}</span>
          <span className="release-name__artist text-muted">
            {release.artist_name || 'Unknown artist'}
          </span>
        </span>
      ),
    },
    {
      key: 'release_type',
      label: 'Type',
      align: 'left',
      render: (release) => (
        <Badge tone="accent">{TYPE_LABELS[release.release_type] || 'Release'}</Badge>
      ),
    },
    {
      key: 'release_date',
      label: 'Release date',
      align: 'left',
      render: (release) => formatDate(release.release_date),
    },
    {
      key: 'stores',
      label: 'Stores',
      align: 'right',
      render: (release) => {
        const delivered = Number(release.delivered_count || 0);
        const total = Number(
          release.store_count != null
            ? release.store_count
            : Array.isArray(release.stores)
              ? release.stores.length
              : 0
        );
        if (!total) return <span className="text-muted">—</span>;
        return (
          <span className="numeric">
            {delivered}/{total}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      align: 'left',
      render: (release) => <StatusBadge status={release.status} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(release) => release.id}
      onRowClick={onSelect}
      emptyMessage="No releases match this filter."
    />
  );
}
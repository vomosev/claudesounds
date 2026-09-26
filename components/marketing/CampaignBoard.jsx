'use client';

import Card from '../ui/Card';
import Badge, { StatusBadge } from '../ui/Badge';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';

const COLUMNS = [
  { key: 'planned', label: 'Planned' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
];

const CHANNEL_LABELS = {
  playlist: 'Playlist pitching',
  social: 'Social',
  ads: 'Paid ads',
  pr: 'PR & press',
  email: 'Email',
};

const NEXT_ACTION = {
  planned: { next: 'active', label: 'Launch' },
  active: { next: 'paused', label: 'Pause' },
  paused: { next: 'active', label: 'Resume' },
  completed: { next: 'planned', label: 'Reopen' },
};

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRange(start, end) {
  const from = formatDate(start);
  const to = formatDate(end);
  if (from && to) return `${from} – ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return 'No dates set';
}

function spendTone(percent) {
  if (percent >= 100) return 'danger';
  if (percent >= 80) return 'warning';
  return 'accent';
}

function CampaignCard({ campaign, onStatusChange, updatingId }) {
  const budget = toNumber(campaign.budget);
  const spend = toNumber(campaign.spend);
  const percent = budget > 0 ? Math.min(Math.round((spend / budget) * 100), 100) : 0;
  const tone = spendTone(budget > 0 ? (spend / budget) * 100 : 0);
  const remaining =
    campaign.budget_remaining !== undefined && campaign.budget_remaining !== null
      ? toNumber(campaign.budget_remaining)
      : budget - spend;
  const action = NEXT_ACTION[campaign.status] || NEXT_ACTION.planned;
  const busy = String(updatingId) === String(campaign.id);

  return (
    <article className="campaign-card">
      <header className="campaign-card__header">
        <h3 className="card__title">{campaign.name}</h3>
        <Badge tone="neutral">{CHANNEL_LABELS[campaign.channel] || campaign.channel}</Badge>
      </header>

      <p className="campaign-card__meta">
        {campaign.release_title ? `Promoting “${campaign.release_title}”` : 'No release linked'}
      </p>
      <p className="campaign-card__meta">{formatRange(campaign.start_date, campaign.end_date)}</p>

      <div
        className={`progress progress--${tone}`}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Budget used for ${campaign.name}`}
      >
        <span className="progress__bar" style={{ width: `${percent}%` }} />
      </div>

      <div className="campaign-card__figures">
        <span className="campaign-card__figure">
          <span className="campaign-card__figure-label">Spend</span>
          <strong>{currency.format(spend)}</strong>
        </span>
        <span className="campaign-card__figure">
          <span className="campaign-card__figure-label">Budget</span>
          <strong>{currency.format(budget)}</strong>
        </span>
        <span className="campaign-card__figure">
          <span className="campaign-card__figure-label">Remaining</span>
          <strong>{currency.format(remaining)}</strong>
        </span>
      </div>

      <footer className="campaign-card__footer">
        <StatusBadge status={campaign.status} />
        {typeof onStatusChange === 'function' ? (
          <Button
            variant="ghost"
            size="sm"
            loading={busy}
            disabled={busy}
            onClick={() => onStatusChange(campaign, action.next)}
          >
            {action.label}
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="campaign-card campaign-card--skeleton" aria-hidden="true">
      <span className="skeleton skeleton--title" />
      <span className="skeleton skeleton--line" />
      <span className="skeleton skeleton--line" />
      <span className="skeleton skeleton--bar" />
    </div>
  );
}

export default function CampaignBoard({
  campaigns = [],
  loading = false,
  error = null,
  onStatusChange,
  onRetry,
  updatingId = null,
}) {
  if (loading) {
    return (
      <div className="campaign-board" aria-busy="true">
        <Spinner size="sm" label="Loading campaigns" />
        {COLUMNS.map((column) => (
          <section className="campaign-board__column" key={column.key}>
            <h2 className="campaign-board__column-title">{column.label}</h2>
            <div className="campaign-board__stack">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        tone="error"
        title="Campaigns could not be loaded"
        description={
          error.message ||
          'We could not reach the ClaudeSounds API. Check your connection and try again.'
        }
        action={
          typeof onRetry === 'function' ? (
            <Button variant="primary" size="md" onClick={onRetry}>
              Retry
            </Button>
          ) : null
        }
      />
    );
  }

  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return (
      <EmptyState
        title="No campaigns yet"
        description="Create your first marketing campaign to pitch playlists, run paid ads or brief your PR team — budgets and spend are tracked here."
      />
    );
  }

  const grouped = COLUMNS.map((column) => ({
    ...column,
    items: campaigns.filter((campaign) => campaign.status === column.key),
  }));

  return (
    <div className="campaign-board">
      {grouped.map((column) => (
        <section className="campaign-board__column" key={column.key}>
          <h2 className="campaign-board__column-title">
            {column.label}
            <Badge tone="neutral">{column.items.length}</Badge>
          </h2>
          <div className="campaign-board__stack">
            {column.items.length === 0 ? (
              <Card padded>
                <p className="campaign-board__hint">No {column.label.toLowerCase()} campaigns.</p>
              </Card>
            ) : (
              column.items.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onStatusChange={onStatusChange}
                  updatingId={updatingId}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
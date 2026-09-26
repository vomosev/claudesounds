'use client';

import Badge from '../ui/Badge';

function formatDelta(delta) {
  if (delta === null || delta === undefined || delta === '') return null;
  const numeric = typeof delta === 'number' ? delta : Number(delta);
  if (Number.isNaN(numeric)) return String(delta);
  const rounded = Math.round(numeric * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

function resolveTone(delta, deltaTone) {
  if (deltaTone) return deltaTone;
  const numeric = typeof delta === 'number' ? delta : Number(delta);
  if (Number.isNaN(numeric) || numeric === 0) return 'neutral';
  return numeric > 0 ? 'success' : 'danger';
}

export default function StatCard({
  label,
  value,
  delta,
  deltaTone,
  hint,
  loading = false,
}) {
  const deltaLabel = formatDelta(delta);
  const tone = resolveTone(delta, deltaTone);

  if (loading) {
    return (
      <div className="stat-card" aria-busy="true">
        <span className="stat-card__label">{label}</span>
        <span className="skeleton skeleton--value" aria-hidden="true" />
        <span className="skeleton skeleton--line" aria-hidden="true" />
        <span className="visually-hidden">Loading {label}</span>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">
        {value === null || value === undefined || value === '' ? '—' : value}
      </span>
      <span className="stat-card__meta">
        {deltaLabel ? (
          <Badge tone={tone}>{deltaLabel}</Badge>
        ) : null}
        {hint ? <span className="stat-card__hint">{hint}</span> : null}
      </span>
    </div>
  );
}
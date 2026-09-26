'use client';

import Card from './Card';

function resolveTone(delta, deltaTone) {
  if (deltaTone) return deltaTone;
  if (typeof delta === 'number') {
    if (delta > 0) return 'success';
    if (delta < 0) return 'danger';
    return 'neutral';
  }
  if (typeof delta === 'string') {
    const trimmed = delta.trim();
    if (trimmed.startsWith('+')) return 'success';
    if (trimmed.startsWith('-')) return 'danger';
  }
  return 'neutral';
}

function formatDelta(delta) {
  if (delta === null || delta === undefined || delta === '') return null;
  if (typeof delta === 'number') {
    if (!Number.isFinite(delta)) return null;
    const rounded = Math.round(delta * 10) / 10;
    const sign = rounded > 0 ? '+' : '';
    return `${sign}${rounded}%`;
  }
  return String(delta);
}

export default function StatCard({
  label,
  value,
  delta,
  deltaTone,
  hint,
  loading = false,
  className = '',
}) {
  const deltaText = formatDelta(delta);
  const tone = resolveTone(delta, deltaTone);

  return (
    <Card className={`stat-card ${className}`.trim()} padded>
      <p className="stat-card__label">{label}</p>

      {loading ? (
        <div className="stat-card__body">
          <span className="skeleton skeleton--value" aria-hidden="true" />
          <span className="skeleton skeleton--line" aria-hidden="true" />
          <span className="sr-only">Loading {label}</span>
        </div>
      ) : (
        <div className="stat-card__body">
          <p className="stat-card__value">{value === null || value === undefined ? '—' : value}</p>
          <div className="stat-card__meta">
            {deltaText ? (
              <span
                className={`badge badge--${tone} stat-card__delta`}
                title="Change vs the previous period"
              >
                {deltaText}
              </span>
            ) : null}
            {hint ? <span className="stat-card__hint">{hint}</span> : null}
          </div>
        </div>
      )}
    </Card>
  );
}
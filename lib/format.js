// Pure formatting helpers — no dependencies, safe on server and client.

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');
const COMPACT_FORMATTER = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const DATE_NO_YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }
  if (typeof value === 'string') {
    // Treat bare YYYY-MM-DD as a calendar date (avoid timezone shifting).
    const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (bare) {
      const d = new Date(
        Number(bare[1]),
        Number(bare[2]) - 1,
        Number(bare[3])
      );
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Format a number with thousands separators. Returns '—' for invalid input.
 */
export function formatNumber(n) {
  const value = toFiniteNumber(n);
  if (value === null) return '—';
  return NUMBER_FORMATTER.format(value);
}

/**
 * Format a number in compact notation (1.2K, 3.4M). Returns '—' for invalid input.
 */
export function formatCompactNumber(n) {
  const value = toFiniteNumber(n);
  if (value === null) return '—';
  if (Math.abs(value) < 1000) return NUMBER_FORMATTER.format(value);
  return COMPACT_FORMATTER.format(value);
}

/**
 * Format an integer number of cents as USD currency. Returns '—' for invalid input.
 */
export function formatCurrencyFromCents(cents) {
  const value = toFiniteNumber(cents);
  if (value === null) return '—';
  return CURRENCY_FORMATTER.format(value / 100);
}

/**
 * Format an ISO date (or Date) as e.g. 'Mar 4, 2025'. Returns '—' for invalid input.
 */
export function formatDate(iso) {
  const date = toDate(iso);
  if (!date) return '—';
  try {
    return DATE_FORMATTER.format(date);
  } catch (err) {
    return '—';
  }
}

/**
 * Format two dates as a range, collapsing the year when both share it.
 */
export function formatDateRange(a, b) {
  const start = toDate(a);
  const end = toDate(b);
  if (!start && !end) return '—';
  if (start && !end) return `${formatDate(start)} — ongoing`;
  if (!start && end) return `Until ${formatDate(end)}`;
  if (start.getFullYear() === end.getFullYear()) {
    return `${DATE_NO_YEAR_FORMATTER.format(start)} – ${DATE_FORMATTER.format(end)}`;
  }
  return `${DATE_FORMATTER.format(start)} – ${DATE_FORMATTER.format(end)}`;
}

/**
 * Format seconds as m:ss (or h:mm:ss past an hour). Returns '—' for invalid input.
 */
export function formatDuration(seconds) {
  const total = toFiniteNumber(seconds);
  if (total === null || total < 0) return '—';
  const whole = Math.floor(total);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${minutes}:${pad(secs)}`;
}

/**
 * Percentage change from previous to current.
 * Returns null when it cannot be computed (missing values, or previous === 0
 * with no current movement).
 */
export function percentChange(current, previous) {
  const now = toFiniteNumber(current);
  const before = toFiniteNumber(previous);
  if (now === null || before === null) return null;
  if (before === 0) {
    if (now === 0) return 0;
    return null;
  }
  const change = ((now - before) / Math.abs(before)) * 100;
  if (!Number.isFinite(change)) return null;
  return Math.round(change * 10) / 10;
}

const STATUS_LABELS = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  live: 'Live',
  takedown: 'Taken down',
  pending: 'Pending',
  delivered: 'Delivered',
  failed: 'Failed',
  unregistered: 'Unregistered',
  submitted: 'Submitted',
  registered: 'Registered',
  scheduled: 'Scheduled',
  running: 'Running',
  completed: 'Completed',
  paused: 'Paused',
  paid: 'Paid',
  playlist_pitch: 'Playlist pitching',
  social_ads: 'Social ads',
  pr: 'PR',
  email: 'Email',
  influencer: 'Influencer',
  single: 'Single',
  ep: 'EP',
  album: 'Album',
  artist: 'Artist',
  label: 'Label',
  admin: 'Admin',
  composer: 'Composer',
  lyricist: 'Lyricist',
  arranger: 'Arranger',
  publisher: 'Publisher',
};

/**
 * Turn a snake_case status/enum value into a human label.
 */
export function titleCaseStatus(status) {
  if (status === null || status === undefined) return '—';
  const key = String(status).trim();
  if (!key) return '—';
  const known = STATUS_LABELS[key.toLowerCase()];
  if (known) return known;
  const words = key.replace(/[_-]+/g, ' ').trim().split(/\s+/);
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export default {
  formatNumber,
  formatCompactNumber,
  formatCurrencyFromCents,
  formatDate,
  formatDateRange,
  formatDuration,
  percentChange,
  titleCaseStatus,
};
'use client';

import React from 'react';

const TONES = ['neutral', 'accent', 'success', 'warning', 'danger'];

export default function Badge({ tone = 'neutral', children, className = '', ...rest }) {
  const safeTone = TONES.includes(tone) ? tone : 'neutral';
  const classes = ['badge', `badge--${safeTone}`, className].filter(Boolean).join(' ');

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}

const STATUS_MAP = {
  // Release statuses
  draft: { label: 'Draft', tone: 'neutral' },
  in_review: { label: 'In review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'accent' },
  live: { label: 'Live', tone: 'success' },
  takedown: { label: 'Taken down', tone: 'danger' },

  // Store delivery statuses
  pending: { label: 'Pending', tone: 'warning' },
  delivered: { label: 'Delivered', tone: 'accent' },
  failed: { label: 'Failed', tone: 'danger' },

  // Campaign statuses
  scheduled: { label: 'Scheduled', tone: 'accent' },
  running: { label: 'Running', tone: 'success' },
  completed: { label: 'Completed', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'warning' },

  // Publishing registration statuses
  unregistered: { label: 'Unregistered', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'warning' },
  registered: { label: 'Registered', tone: 'success' },

  // Royalty statement statuses
  paid: { label: 'Paid', tone: 'success' },
};

export function statusToLabel(status) {
  if (status === null || status === undefined || status === '') return 'Unknown';
  const key = String(status).trim().toLowerCase();
  const match = STATUS_MAP[key];
  if (match) return match.label;
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function statusToTone(status) {
  if (status === null || status === undefined || status === '') return 'neutral';
  const key = String(status).trim().toLowerCase();
  const match = STATUS_MAP[key];
  return match ? match.tone : 'neutral';
}

export function StatusBadge({ status, label, className = '', ...rest }) {
  const tone = statusToTone(status);
  const text = label || statusToLabel(status);

  return (
    <Badge tone={tone} className={className} title={text} {...rest}>
      {text}
    </Badge>
  );
}
'use client';

import Table from '../ui/Table';
import { StatusBadge } from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';

const columns = [
  {
    key: 'title',
    label: 'Work title',
    render: (work) => <span className="release-name">{work.title}</span>,
  },
  {
    key: 'iswc',
    label: 'ISWC',
    render: (work) => (work.iswc ? work.iswc : <span className="text-muted">Not assigned</span>),
  },
  {
    key: 'writers',
    label: 'Writers',
    render: (work) => <span className="table__wrap">{work.writers || '—'}</span>,
  },
  {
    key: 'publisher',
    label: 'Publisher',
    render: (work) => work.publisher || <span className="text-muted">Self-published</span>,
  },
  {
    key: 'split_percent',
    label: 'Split',
    align: 'right',
    render: (work) => {
      const value = Number(work.split_percent);
      return Number.isFinite(value) ? `${value.toFixed(2)}%` : '—';
    },
  },
  {
    key: 'registration_status',
    label: 'Registration',
    render: (work) => <StatusBadge status={work.registration_status} />,
  },
];

export default function WorksTable({ works, loading, error, onEdit, onRetry }) {
  if (loading) {
    return (
      <div className="table-skeleton" aria-live="polite">
        <div className="cluster cluster--center">
          <Spinner size="md" label="Loading publishing works" />
          <p className="text-muted">Loading your registered compositions…</p>
        </div>
        <div className="skeleton-rows">
          <span className="skeleton skeleton--row" />
          <span className="skeleton skeleton--row" />
          <span className="skeleton skeleton--row" />
          <span className="skeleton skeleton--row" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        tone="error"
        title="We couldn't load your works"
        description={
          error.message ||
          'The publishing service is not responding right now. Check your connection and try again.'
        }
        action={
          onRetry ? (
            <Button variant="secondary" size="md" onClick={onRetry}>
              Retry
            </Button>
          ) : null
        }
      />
    );
  }

  if (!works || works.length === 0) {
    return (
      <EmptyState
        title="Register your first composition"
        description="Publishing works hold the songwriting side of your music. Register a work to collect mechanical and performance royalties from collection societies worldwide."
      />
    );
  }

  return (
    <Table
      columns={columns}
      rows={works}
      rowKey={(work) => work.id}
      onRowClick={onEdit ? (work) => onEdit(work) : undefined}
      emptyMessage="Register your first composition"
    />
  );
}
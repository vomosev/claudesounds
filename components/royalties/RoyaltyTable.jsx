'use client';

import Table from '../ui/Table';
import { StatusBadge } from '../ui/Badge';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return currency.format(0);
  return currency.format(numeric);
}

const SKELETON_ROWS = [
  { id: 'skeleton-1' },
  { id: 'skeleton-2' },
  { id: 'skeleton-3' },
  { id: 'skeleton-4' },
];

export default function RoyaltyTable({
  statements = [],
  loading = false,
  error = null,
  onRequestPayout,
  onRetry,
  pendingId = null,
}) {
  if (error) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load your royalty statements"
        description={
          typeof error === 'string'
            ? error
            : error.message || 'The ClaudeSounds API did not respond. Check your connection and try again.'
        }
        action={
          onRetry ? (
            <Button variant="primary" size="md" onClick={onRetry}>
              Retry
            </Button>
          ) : null
        }
      />
    );
  }

  if (loading) {
    const skeletonColumns = [
      { key: 'period', label: 'Period', render: () => <span className="skeleton skeleton--text" /> },
      { key: 'gross', label: 'Gross', align: 'right', render: () => <span className="skeleton skeleton--text" /> },
      { key: 'fees', label: 'Fees', align: 'right', render: () => <span className="skeleton skeleton--text" /> },
      { key: 'net', label: 'Net', align: 'right', render: () => <span className="skeleton skeleton--text" /> },
      { key: 'status', label: 'Status', render: () => <span className="skeleton skeleton--badge" /> },
      { key: 'action', label: '', align: 'right', render: () => <span className="skeleton skeleton--button" /> },
    ];

    return (
      <div aria-busy="true">
        <Table columns={skeletonColumns} rows={SKELETON_ROWS} rowKey="id" />
        <p className="visually-hidden">
          <Spinner size="sm" label="Loading royalty statements" />
        </p>
      </div>
    );
  }

  if (!statements.length) {
    return (
      <EmptyState
        title="No statements yet"
        description="Earnings post monthly, roughly 45 days after the end of each reporting period. Your first statement will appear here once stores report."
      />
    );
  }

  const columns = [
    {
      key: 'period_label',
      label: 'Period',
      render: (row) => <span className="release-name">{row.period_label || 'Unlabelled period'}</span>,
    },
    {
      key: 'gross_amount',
      label: 'Gross',
      align: 'right',
      render: (row) => <span className="num">{formatMoney(row.gross_amount)}</span>,
    },
    {
      key: 'fees_amount',
      label: 'Fees',
      align: 'right',
      render: (row) => <span className="num num--muted">-{formatMoney(row.fees_amount)}</span>,
    },
    {
      key: 'net_amount',
      label: 'Net',
      align: 'right',
      render: (row) => <span className="num num--strong">{formatMoney(row.net_amount)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'action',
      label: 'Payout',
      align: 'right',
      render: (row) => {
        if (row.status === 'paid') {
          const paid = row.paid_at ? new Date(row.paid_at) : null;
          const label =
            paid && !Number.isNaN(paid.getTime())
              ? `Paid ${paid.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'Paid';
          return <span className="text-muted">{label}</span>;
        }

        return (
          <Button
            variant="primary"
            size="sm"
            loading={pendingId === row.id}
            disabled={pendingId != null && pendingId !== row.id}
            onClick={() => {
              if (typeof onRequestPayout === 'function') onRequestPayout(row);
            }}
          >
            Request payout
          </Button>
        );
      },
    },
  ];

  return (
    <Table
      columns={columns}
      rows={statements}
      rowKey="id"
      emptyMessage="No statements yet — earnings post monthly."
    />
  );
}
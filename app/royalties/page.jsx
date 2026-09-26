'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import RoyaltyTable from '../../components/royalties/RoyaltyTable';
import { Card, CardGrid } from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat('en-US');

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function RoyaltiesPage() {
  const [statements, setStatements] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [breakdownError, setBreakdownError] = useState('');
  const [pendingId, setPendingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setBreakdownError('');
    setActionError('');

    const [statementsResult, breakdownResult] = await Promise.allSettled([
      api.listStatements(),
      api.getRoyaltyBreakdown(),
    ]);

    if (statementsResult.status === 'fulfilled') {
      const data = statementsResult.value;
      setStatements(Array.isArray(data) ? data : data?.statements || []);
    } else {
      const err = statementsResult.reason;
      setStatements([]);
      setError(
        err && err.status === 401
          ? 'Sign in to view your royalty statements.'
          : (err && err.message) || 'We could not reach the ClaudeSounds API.'
      );
    }

    if (breakdownResult.status === 'fulfilled') {
      const data = breakdownResult.value;
      setBreakdown(Array.isArray(data) ? data : data?.breakdown || []);
    } else {
      const err = breakdownResult.reason;
      setBreakdown([]);
      setBreakdownError(
        (err && err.message) || 'Store revenue breakdown is unavailable right now.'
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRequestPayout(statement) {
    if (!statement || pendingId) return;
    setPendingId(statement.id);
    setActionError('');
    setNotice('');
    try {
      await api.requestPayout(statement.id);
      setStatements((prev) =>
        prev.map((row) =>
          row.id === statement.id
            ? { ...row, status: 'paid', paid_at: new Date().toISOString() }
            : row
        )
      );
      setNotice(`Payout requested for ${statement.period_label || 'this period'}.`);
    } catch (err) {
      setActionError(
        (err && err.message) || 'The payout request failed. Please try again.'
      );
    } finally {
      setPendingId(null);
    }
  }

  const totalNet = statements.reduce((sum, row) => sum + toNumber(row.net_amount), 0);
  const totalPending = statements
    .filter((row) => row.status === 'pending')
    .reduce((sum, row) => sum + toNumber(row.net_amount), 0);

  const breakdownTotal = breakdown.reduce(
    (sum, row) => sum + toNumber(row.revenue),
    0
  );

  return (
    <section className="stack">
      <header className="page-header">
        <h1>Royalties</h1>
        <p>
          Earnings from every store post to ClaudeSounds monthly. Review a statement,
          check the fees applied, then request a payout once the period is finalised.
        </p>
        <div className="cluster">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </header>

      {notice ? (
        <p className="alert alert--success" role="status">
          {notice}
        </p>
      ) : null}

      {actionError ? (
        <p className="alert alert--danger" role="alert">
          {actionError}
        </p>
      ) : null}

      <CardGrid>
        <Card title="Lifetime net earnings" subtitle="All statements to date">
          <p className="stat-card__value">
            {loading ? <span className="skeleton skeleton--text" /> : currency.format(totalNet)}
          </p>
        </Card>
        <Card title="Awaiting payout" subtitle="Pending statements">
          <p className="stat-card__value">
            {loading ? (
              <span className="skeleton skeleton--text" />
            ) : (
              currency.format(totalPending)
            )}
          </p>
        </Card>
        <Card title="Statements" subtitle="Periods on record">
          <p className="stat-card__value">
            {loading ? (
              <span className="skeleton skeleton--text" />
            ) : (
              numberFmt.format(statements.length)
            )}
          </p>
        </Card>
      </CardGrid>

      <Card title="Statements" subtitle="Gross, fees and net per accounting period" padded={false}>
        <RoyaltyTable
          statements={statements}
          loading={loading}
          error={error}
          onRequestPayout={handleRequestPayout}
          onRetry={load}
          pendingId={pendingId}
        />
      </Card>

      <Card title="Revenue by store" subtitle="Where your earnings came from">
        {loading ? (
          <div className="panel-loading">
            <Spinner size="md" label="Loading store breakdown" />
          </div>
        ) : breakdownError ? (
          <EmptyState
            tone="error"
            title="Breakdown unavailable"
            description={breakdownError}
            action={
              <Button variant="secondary" size="sm" onClick={load}>
                Retry
              </Button>
            }
          />
        ) : breakdown.length === 0 ? (
          <EmptyState
            title="No store revenue yet"
            description="Once your releases go live and streams report in, per-store revenue appears here."
          />
        ) : (
          <ul className="breakdown-list">
            {breakdown.map((row) => {
              const revenue = toNumber(row.revenue);
              const share = breakdownTotal > 0 ? (revenue / breakdownTotal) * 100 : 0;
              return (
                <li className="breakdown-list__item" key={row.store_name}>
                  <div className="breakdown-list__head">
                    <span className="breakdown-list__name">{row.store_name}</span>
                    <span className="breakdown-list__value">{currency.format(revenue)}</span>
                  </div>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-valuenow={Math.round(share)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${row.store_name} share of revenue`}
                  >
                    <span
                      className="progress__bar"
                      style={{ inlineSize: `${Math.min(100, Math.max(2, share))}%` }}
                    />
                  </div>
                  <p className="breakdown-list__meta">
                    {numberFmt.format(toNumber(row.streams))} streams &middot;{' '}
                    {share.toFixed(1)}% of revenue
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
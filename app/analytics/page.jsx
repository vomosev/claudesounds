'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useRequireAuth from '../../lib/useRequireAuth';
import { analytics } from '../../lib/api';
import {
  formatNumber,
  formatCompactNumber,
  formatCurrencyFromCents,
  formatDate,
} from '../../lib/format';
import BarChart from '../../components/charts/BarChart';
import StatCard from '../../components/ui/StatCard';
import Table from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import AsyncView from '../../components/ui/AsyncView';
import Card, { CardHeader, CardBody } from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

export default function AnalyticsPage() {
  const { user, status } = useRequireAuth();

  const [days, setDays] = useState(30);

  const [series, setSeries] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [seriesError, setSeriesError] = useState(null);

  const [topReleases, setTopReleases] = useState([]);
  const [topLoading, setTopLoading] = useState(true);
  const [topError, setTopError] = useState(null);

  const [royalties, setRoyalties] = useState([]);
  const [royaltyLoading, setRoyaltyLoading] = useState(true);
  const [royaltyError, setRoyaltyError] = useState(null);

  const loadSeries = useCallback(
    async (signal) => {
      setSeriesLoading(true);
      setSeriesError(null);
      try {
        const data = await analytics.timeseries(days, { signal });
        const rows = Array.isArray(data) ? data : data?.series || [];
        setSeries(rows);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setSeriesError(
          err?.message || 'We could not load your streaming data right now.'
        );
        setSeries([]);
      } finally {
        setSeriesLoading(false);
      }
    },
    [days]
  );

  const loadTopReleases = useCallback(async (signal) => {
    setTopLoading(true);
    setTopError(null);
    try {
      const data = await analytics.topReleases({ signal });
      const rows = Array.isArray(data) ? data : data?.releases || [];
      setTopReleases(rows);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setTopError(err?.message || 'We could not load your top releases.');
      setTopReleases([]);
    } finally {
      setTopLoading(false);
    }
  }, []);

  const loadRoyalties = useCallback(async (signal) => {
    setRoyaltyLoading(true);
    setRoyaltyError(null);
    try {
      const data = await analytics.royalties({ signal });
      const rows = Array.isArray(data) ? data : data?.statements || [];
      setRoyalties(rows);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setRoyaltyError(err?.message || 'We could not load your royalty statements.');
      setRoyalties([]);
    } finally {
      setRoyaltyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    const controller = new AbortController();
    loadSeries(controller.signal);
    return () => controller.abort();
  }, [status, loadSeries]);

  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    const controller = new AbortController();
    loadTopReleases(controller.signal);
    loadRoyalties(controller.signal);
    return () => controller.abort();
  }, [status, loadTopReleases, loadRoyalties]);

  const totals = useMemo(() => {
    return series.reduce(
      (acc, point) => {
        acc.streams += Number(point.streams) || 0;
        acc.listeners += Number(point.listeners) || 0;
        acc.revenueCents += Number(point.revenueCents ?? point.revenue_cents) || 0;
        return acc;
      },
      { streams: 0, listeners: 0, revenueCents: 0 }
    );
  }, [series]);

  const chartData = useMemo(
    () =>
      series.map((point) => ({
        label: formatDate(point.date),
        value: Number(point.streams) || 0,
      })),
    [series]
  );

  const topColumns = useMemo(
    () => [
      {
        key: 'title',
        header: 'Release',
        render: (row) => (
          <span className="break-word">{row.title || 'Untitled release'}</span>
        ),
      },
      {
        key: 'artist_name',
        header: 'Artist',
        render: (row) => (
          <span className="break-word">{row.artist_name || row.artistName || '—'}</span>
        ),
      },
      {
        key: 'platforms',
        header: 'Platform breakdown',
        render: (row) => {
          const breakdown = row.platforms || row.breakdown || [];
          if (!Array.isArray(breakdown) || breakdown.length === 0) {
            return <span className="text-muted">No platform data</span>;
          }
          return (
            <span className="cluster cluster--tight">
              {breakdown.map((p) => (
                <span className="badge badge--neutral" key={p.platform}>
                  {p.platform}: {formatCompactNumber(Number(p.streams) || 0)}
                </span>
              ))}
            </span>
          );
        },
      },
      {
        key: 'streams',
        header: 'Streams',
        align: 'right',
        render: (row) => formatNumber(Number(row.streams) || 0),
      },
      {
        key: 'listeners',
        header: 'Listeners',
        align: 'right',
        render: (row) => formatNumber(Number(row.listeners) || 0),
      },
    ],
    []
  );

  const royaltyColumns = useMemo(
    () => [
      {
        key: 'period_label',
        header: 'Period',
        render: (row) => (
          <span className="break-word">{row.period_label || row.periodLabel || '—'}</span>
        ),
      },
      {
        key: 'gross_cents',
        header: 'Gross',
        align: 'right',
        render: (row) => formatCurrencyFromCents(row.gross_cents ?? row.grossCents ?? 0),
      },
      {
        key: 'fee_cents',
        header: 'Fee',
        align: 'right',
        render: (row) => formatCurrencyFromCents(row.fee_cents ?? row.feeCents ?? 0),
      },
      {
        key: 'net_cents',
        header: 'Net',
        align: 'right',
        render: (row) => formatCurrencyFromCents(row.net_cents ?? row.netCents ?? 0),
      },
      {
        key: 'issued_at',
        header: 'Issued',
        render: (row) => formatDate(row.issued_at || row.issuedAt),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status || 'pending'} />,
      },
    ],
    []
  );

  if (status === 'loading') {
    return (
      <div className="page-center">
        <Spinner size="lg" label="Loading your analytics" />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <div className="stack">
      <header className="page-head">
        <h1>Analytics</h1>
        <p className="prose">
          Daily streaming performance across every store {user?.artistName || 'your catalogue'} is
          delivered to, plus the royalty statements ClaudeSounds has issued for those streams.
        </p>
      </header>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Select reporting range">
          {RANGES.map((range) => (
            <Button
              key={range.days}
              size="sm"
              variant={days === range.days ? 'primary' : 'ghost'}
              onClick={() => setDays(range.days)}
              aria-pressed={days === range.days}
            >
              {range.label}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            loadSeries();
            loadTopReleases();
            loadRoyalties();
          }}
        >
          Refresh
        </Button>
      </div>

      <section className="stats-grid">
        <StatCard
          label={`Streams · last ${days} days`}
          value={formatNumber(totals.streams)}
          hint="All stores combined"
          loading={seriesLoading}
        />
        <StatCard
          label="Listeners"
          value={formatNumber(totals.listeners)}
          hint="Unique listeners reported by stores"
          loading={seriesLoading}
        />
        <StatCard
          label="Estimated revenue"
          value={formatCurrencyFromCents(totals.revenueCents)}
          hint="Before ClaudeSounds distribution fee"
          loading={seriesLoading}
        />
      </section>

      <Card>
        <CardHeader
          title="Daily streams"
          subtitle={`Stream volume per day over the last ${days} days`}
        />
        <CardBody>
          <AsyncView
            loading={seriesLoading}
            error={seriesError}
            onRetry={() => loadSeries()}
            isEmpty={!seriesLoading && !seriesError && chartData.length === 0}
            emptyTitle="No streaming data yet"
            emptyDescription="Once your releases go live on stores, daily stream counts will appear here within 48 hours of reporting."
            skeleton={<div className="skeleton skeleton--chart" aria-hidden="true" />}
          >
            <BarChart
              data={chartData}
              height={280}
              ariaLabel={`Daily streams for the last ${days} days`}
              valueFormatter={(value) => `${formatNumber(value)} streams`}
            />
          </AsyncView>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Top releases"
          subtitle="Your five best performing releases with per-store breakdown"
        />
        <CardBody>
          <AsyncView
            loading={topLoading}
            error={topError}
            onRetry={() => loadTopReleases()}
            isEmpty={!topLoading && !topError && topReleases.length === 0}
            emptyTitle="No release performance yet"
            emptyDescription="Deliver a release to stores and its streaming performance will be ranked here."
            skeleton={<Table columns={topColumns} rows={[]} loading skeletonRows={5} />}
          >
            <Table
              columns={topColumns}
              rows={topReleases}
              rowKey={(row) => row.id ?? row.release_id ?? row.title}
              emptyMessage="No release performance yet"
            />
          </AsyncView>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Royalty statements"
          subtitle="Issued statements, fees deducted and amounts paid out"
        />
        <CardBody>
          <AsyncView
            loading={royaltyLoading}
            error={royaltyError}
            onRetry={() => loadRoyalties()}
            isEmpty={!royaltyLoading && !royaltyError && royalties.length === 0}
            emptyTitle="No statements issued yet"
            emptyDescription="ClaudeSounds issues a statement each month once stores report earnings for your catalogue."
            skeleton={<Table columns={royaltyColumns} rows={[]} loading skeletonRows={3} />}
          >
            <Table
              columns={royaltyColumns}
              rows={royalties}
              rowKey={(row) => row.id ?? row.period_label}
              emptyMessage="No statements issued yet"
            />
          </AsyncView>
        </CardBody>
      </Card>
    </div>
  );
}
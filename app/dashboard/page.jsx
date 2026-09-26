'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import useRequireAuth from '../../lib/useRequireAuth';
import { analytics, releases as releasesApi, campaigns as campaignsApi } from '../../lib/api';
import {
  formatNumber,
  formatCompactNumber,
  formatCurrencyFromCents,
  formatDate,
} from '../../lib/format';
import StatCard from '../../components/ui/StatCard';
import BarChart from '../../components/charts/BarChart';
import ReleaseCard from '../../components/releases/ReleaseCard';
import Table from '../../components/ui/Table';
import AsyncView from '../../components/ui/AsyncView';
import Card, { CardHeader, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/Badge';

const CHANNEL_LABELS = {
  playlist_pitch: 'Playlist pitching',
  social_ads: 'Social ads',
  pr: 'PR',
  email: 'Email',
  influencer: 'Influencer',
};

export default function DashboardPage() {
  const { user, status } = useRequireAuth();

  const [overview, setOverview] = useState(null);
  const [overviewState, setOverviewState] = useState({ loading: true, error: null });

  const [series, setSeries] = useState([]);
  const [seriesState, setSeriesState] = useState({ loading: true, error: null });

  const [releaseList, setReleaseList] = useState([]);
  const [releaseState, setReleaseState] = useState({ loading: true, error: null });

  const [campaignList, setCampaignList] = useState([]);
  const [campaignState, setCampaignState] = useState({ loading: true, error: null });

  const loadOverview = useCallback(async () => {
    setOverviewState({ loading: true, error: null });
    try {
      const data = await analytics.overview();
      setOverview(data && data.overview ? data.overview : data);
      setOverviewState({ loading: false, error: null });
    } catch (err) {
      setOverview(null);
      setOverviewState({
        loading: false,
        error: err && err.message ? err.message : 'We could not load your dashboard totals.',
      });
    }
  }, []);

  const loadSeries = useCallback(async () => {
    setSeriesState({ loading: true, error: null });
    try {
      const data = await analytics.timeseries(30);
      const points = Array.isArray(data) ? data : data && data.series ? data.series : [];
      setSeries(points);
      setSeriesState({ loading: false, error: null });
    } catch (err) {
      setSeries([]);
      setSeriesState({
        loading: false,
        error: err && err.message ? err.message : 'Stream history is unavailable right now.',
      });
    }
  }, []);

  const loadReleases = useCallback(async () => {
    setReleaseState({ loading: true, error: null });
    try {
      const data = await releasesApi.list();
      const items = Array.isArray(data) ? data : data && data.releases ? data.releases : [];
      setReleaseList(items.slice(0, 3));
      setReleaseState({ loading: false, error: null });
    } catch (err) {
      setReleaseList([]);
      setReleaseState({
        loading: false,
        error: err && err.message ? err.message : 'We could not load your catalogue.',
      });
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    setCampaignState({ loading: true, error: null });
    try {
      const data = await campaignsApi.list({ status: 'running' });
      const items = Array.isArray(data) ? data : data && data.campaigns ? data.campaigns : [];
      setCampaignList(items);
      setCampaignState({ loading: false, error: null });
    } catch (err) {
      setCampaignList([]);
      setCampaignState({
        loading: false,
        error: err && err.message ? err.message : 'We could not load your campaigns.',
      });
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    loadOverview();
    loadSeries();
    loadReleases();
    loadCampaigns();
  }, [status, loadOverview, loadSeries, loadReleases, loadCampaigns]);

  if (status === 'loading' || status === 'anonymous') {
    return (
      <div className="page-center">
        <Spinner size="lg" label="Loading your dashboard" />
      </div>
    );
  }

  const greetingName =
    (user && (user.artistName || user.displayName)) || 'artist';

  const chartData = series.map((point) => ({
    label: formatDate(point.date),
    value: Number(point.streams) || 0,
  }));

  const campaignColumns = [
    {
      key: 'name',
      header: 'Campaign',
      render: (row) => <span className="campaign-name">{row.name}</span>,
    },
    {
      key: 'channel',
      header: 'Channel',
      render: (row) => CHANNEL_LABELS[row.channel] || row.channel,
    },
    {
      key: 'release_title',
      header: 'Release',
      render: (row) => (
        <span className="break-word">{row.release_title || 'Catalogue-wide'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'spend',
      header: 'Spend / Budget',
      align: 'right',
      render: (row) =>
        `${formatCurrencyFromCents(row.spend_cents || 0)} / ${formatCurrencyFromCents(
          row.budget_cents || 0
        )}`,
    },
    {
      key: 'ctr',
      header: 'CTR',
      align: 'right',
      render: (row) => {
        const impressions = Number(row.impressions) || 0;
        const clicks = Number(row.clicks) || 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        return `${ctr.toFixed(2)}%`;
      },
    },
  ];

  return (
    <div className="stack stack--lg">
      <header className="page-head">
        <h1>Welcome back, {greetingName}</h1>
        <p className="prose text-muted">
          Here is how your catalogue performed over the last 30 days across distribution,
          publishing and marketing.
        </p>
      </header>

      <section aria-labelledby="dashboard-totals">
        <h2 id="dashboard-totals" className="section-title">
          Last 30 days
        </h2>
        <AsyncView
          loading={overviewState.loading}
          error={overviewState.error}
          onRetry={loadOverview}
          isEmpty={!overviewState.loading && !overviewState.error && !overview}
          emptyTitle="No performance data yet"
          emptyDescription="Once your first release goes live, stream and royalty totals will appear here."
        >
          <div className="grid grid--stats">
            <StatCard
              label="Streams (30 days)"
              value={formatNumber(overview ? overview.streams : 0)}
              delta={overview ? overview.streamsChangePercent : null}
              deltaTone={
                overview && Number(overview.streamsChangePercent) < 0 ? 'danger' : 'success'
              }
              hint="vs previous 30 days"
            />
            <StatCard
              label="Monthly listeners"
              value={formatCompactNumber(overview ? overview.listeners : 0)}
              delta={overview ? overview.listenersChangePercent : null}
              deltaTone={
                overview && Number(overview.listenersChangePercent) < 0 ? 'danger' : 'success'
              }
              hint="Unique listeners across stores"
            />
            <StatCard
              label="Live releases"
              value={formatNumber(overview ? overview.liveReleases ?? overview.activeReleases : 0)}
              hint={`${formatNumber(
                overview ? overview.liveDeliveries || 0 : 0
              )} live store deliveries`}
            />
            <StatCard
              label="Unpaid royalties"
              value={formatCurrencyFromCents(overview ? overview.unpaidRoyaltyCents || 0 : 0)}
              hint={`${formatNumber(
                overview ? overview.runningCampaigns || 0 : 0
              )} campaigns running`}
            />
          </div>
        </AsyncView>
      </section>

      <section aria-labelledby="dashboard-streams">
        <h2 id="dashboard-streams" className="section-title">
          Daily streams
        </h2>
        <Card padded>
          <CardHeader
            title="Streams per day"
            subtitle="Aggregated across every connected store"
            actions={
              <Button as="link" href="/analytics" variant="ghost" size="sm">
                Full analytics
              </Button>
            }
          />
          <CardBody>
            <AsyncView
              loading={seriesState.loading}
              error={seriesState.error}
              onRetry={loadSeries}
              isEmpty={!seriesState.loading && !seriesState.error && chartData.length === 0}
              emptyTitle="No streams recorded yet"
              emptyDescription="Stream reporting from stores usually starts 48 hours after a release goes live."
            >
              <BarChart
                data={chartData}
                height={260}
                ariaLabel="Daily streams over the last 30 days"
                valueFormatter={(value) => `${formatNumber(value)} streams`}
              />
            </AsyncView>
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="dashboard-releases">
        <h2 id="dashboard-releases" className="section-title">
          Recent releases
        </h2>
        <AsyncView
          loading={releaseState.loading}
          error={releaseState.error}
          onRetry={loadReleases}
          isEmpty={!releaseState.loading && !releaseState.error && releaseList.length === 0}
          emptyTitle="Your catalogue is empty"
          emptyDescription="Upload artwork, audio and metadata to send your first single to Spotify, Apple Music and more."
          emptyAction={
            <Button as="link" href="/releases/new" variant="primary" size="md">
              Create your first release
            </Button>
          }
        >
          <div className="grid grid--releases">
            {releaseList.map((release) => (
              <ReleaseCard key={release.id} release={release} />
            ))}
          </div>
          <div className="cluster cluster--end">
            <Link href="/releases">View all releases</Link>
          </div>
        </AsyncView>
      </section>

      <section aria-labelledby="dashboard-campaigns">
        <h2 id="dashboard-campaigns" className="section-title">
          Active campaigns
        </h2>
        <AsyncView
          loading={campaignState.loading}
          error={campaignState.error}
          onRetry={loadCampaigns}
          isEmpty={!campaignState.loading && !campaignState.error && campaignList.length === 0}
          emptyTitle="No campaigns running"
          emptyDescription="Pitch a release to editorial playlists or launch social ads to grow your audience."
          emptyAction={
            <Button as="link" href="/marketing" variant="primary" size="md">
              Plan a campaign
            </Button>
          }
        >
          <Table
            columns={campaignColumns}
            rows={campaignList}
            rowKey={(row) => row.id}
            emptyMessage="No campaigns running"
            skeletonRows={3}
          />
          <div className="cluster cluster--end">
            <Link href="/marketing">Manage marketing</Link>
          </div>
        </AsyncView>
      </section>
    </div>
  );
}
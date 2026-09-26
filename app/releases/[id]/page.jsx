'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useRequireAuth from '../../../lib/useRequireAuth';
import { releases as releasesApi, analytics as analyticsApi } from '../../../lib/api';
import {
  formatDate,
  formatDuration,
  formatNumber,
  titleCaseStatus,
} from '../../../lib/format';
import Table from '../../../components/ui/Table';
import Badge, { StatusBadge } from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import AsyncView from '../../../components/ui/AsyncView';
import Spinner from '../../../components/ui/Spinner';
import Card, { CardBody, CardHeader } from '../../../components/ui/Card';
import ReleaseForm from '../../../components/releases/ReleaseForm';
import BarChart from '../../../components/charts/BarChart';

const STORE_ORDER = [
  'Spotify',
  'Apple Music',
  'Amazon Music',
  'YouTube Music',
  'Deezer',
  'Tidal',
];

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function ReleaseDetailPage() {
  const { status: authStatus } = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const releaseId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [release, setRelease] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [series, setSeries] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [seriesError, setSeriesError] = useState(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deliverOpen, setDeliverOpen] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [deliverError, setDeliverError] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const loadRelease = useCallback(async () => {
    if (!releaseId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await releasesApi.get(releaseId);
      const record = data?.release || data || null;
      if (!record) {
        setNotFound(true);
        setRelease(null);
        setTracks([]);
        setDeliveries([]);
      } else {
        setRelease(record);
        setTracks(data?.tracks || record.tracks || []);
        setDeliveries(data?.deliveries || data?.storeDeliveries || record.deliveries || []);
      }
    } catch (err) {
      if (err && err.status === 404) {
        setNotFound(true);
      } else {
        setError(err?.message || 'We couldn\u2019t load this release.');
      }
    } finally {
      setLoading(false);
    }
  }, [releaseId]);

  const loadSeries = useCallback(async () => {
    if (!releaseId) return;
    setSeriesLoading(true);
    setSeriesError(null);
    try {
      const data = await analyticsApi.timeseries({ days: 30, releaseId });
      const rows = Array.isArray(data) ? data : data?.series || data?.data || [];
      setSeries(rows);
    } catch (err) {
      setSeriesError(err?.message || 'Stream data is unavailable right now.');
    } finally {
      setSeriesLoading(false);
    }
  }, [releaseId]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    loadRelease();
    loadSeries();
  }, [authStatus, loadRelease, loadSeries]);

  const chartData = useMemo(
    () =>
      (series || []).map((point) => ({
        label: formatDate(point.date),
        value: Number(point.streams) || 0,
      })),
    [series]
  );

  const deliveryRows = useMemo(() => {
    const byStore = new Map();
    (deliveries || []).forEach((d) => {
      byStore.set(d.store_name || d.storeName, d);
    });
    const known = STORE_ORDER.map((name) => {
      const found = byStore.get(name);
      byStore.delete(name);
      return (
        found || {
          id: `pending-${name}`,
          store_name: name,
          status: 'pending',
          delivered_at: null,
        }
      );
    });
    return [...known, ...Array.from(byStore.values())];
  }, [deliveries]);

  const initialFormValues = useMemo(() => {
    if (!release) return undefined;
    return {
      title: release.title || '',
      artistName: release.artist_name || release.artistName || '',
      releaseType: release.release_type || release.releaseType || 'single',
      primaryGenre: release.primary_genre || release.primaryGenre || '',
      label: release.label || '',
      upc: release.upc || '',
      releaseDate: toDateInput(release.release_date || release.releaseDate),
      artworkColor: release.artwork_color || release.artworkColor || '#f0a03c',
      tracks: (tracks || []).map((t) => ({
        title: t.title || '',
        isrc: t.isrc || '',
        duration: formatDuration(t.duration_seconds || t.durationSeconds || 0),
        explicit: Boolean(t.explicit),
        songwriters: t.songwriters || '',
      })),
    };
  }, [release, tracks]);

  async function handleSave(values) {
    setSaving(true);
    setSaveError(null);
    try {
      await releasesApi.update(releaseId, values);
      setEditing(false);
      await loadRelease();
    } catch (err) {
      setSaveError(err?.message || 'We couldn\u2019t save your changes. Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeliver() {
    setDelivering(true);
    setDeliverError(null);
    try {
      await releasesApi.deliver(releaseId);
      setDeliverOpen(false);
      await loadRelease();
    } catch (err) {
      setDeliverError(err?.message || 'Delivery could not be started. Try again in a moment.');
    } finally {
      setDelivering(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await releasesApi.remove(releaseId);
      setDeleteOpen(false);
      router.push('/releases');
    } catch (err) {
      setDeleteError(err?.message || 'We couldn\u2019t delete this release.');
      setDeleting(false);
    }
  }

  if (authStatus === 'loading') {
    return (
      <div className="page-center">
        <Spinner size="lg" label="Loading your account" />
      </div>
    );
  }

  if (authStatus !== 'authenticated') {
    return null;
  }

  const accent = release?.artwork_color || release?.artworkColor || '#f0a03c';

  const trackColumns = [
    { key: 'track_number', header: '#', align: 'right', width: '4rem' },
    {
      key: 'title',
      header: 'Track',
      render: (row) => <span className="break-word">{row.title}</span>,
    },
    {
      key: 'isrc',
      header: 'ISRC',
      render: (row) => <span className="mono">{row.isrc || 'Not assigned'}</span>,
    },
    {
      key: 'duration_seconds',
      header: 'Duration',
      align: 'right',
      render: (row) => formatDuration(row.duration_seconds || row.durationSeconds || 0),
    },
    {
      key: 'explicit',
      header: 'Explicit',
      render: (row) =>
        row.explicit ? <Badge tone="warning">Explicit</Badge> : <Badge tone="neutral">Clean</Badge>,
    },
    {
      key: 'songwriters',
      header: 'Songwriters',
      render: (row) => <span className="break-word">{row.songwriters || '\u2014'}</span>,
    },
  ];

  const deliveryColumns = [
    {
      key: 'store_name',
      header: 'Store',
      render: (row) => <span className="break-word">{row.store_name || row.storeName}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'delivered_at',
      header: 'Delivered',
      render: (row) =>
        row.delivered_at || row.deliveredAt
          ? formatDate(row.delivered_at || row.deliveredAt)
          : 'Not yet delivered',
    },
  ];

  return (
    <div className="stack stack--lg">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/releases">Back to releases</Link>
      </nav>

      <AsyncView
        loading={loading}
        error={error}
        isEmpty={notFound}
        onRetry={loadRelease}
        emptyTitle="We couldn\u2019t find that release"
        emptyDescription="It may have been deleted, or it belongs to another ClaudeSounds account. Head back to your catalogue to pick another release."
        emptyAction={
          <Button as="link" href="/releases" variant="primary">
            Back to catalogue
          </Button>
        }
        skeleton={
          <div className="stack stack--lg">
            <div className="skeleton skeleton--hero" />
            <div className="skeleton skeleton--panel" />
          </div>
        }
      >
        {release ? (
          <div className="stack stack--lg">
            <header className="release-header">
              <div
                className="artwork-tile artwork-tile--lg"
                style={{ '--artwork-color': accent }}
                aria-hidden="true"
              />
              <div className="release-header__body stack">
                <div className="cluster cluster--between">
                  <div className="release-header__titles">
                    <h1 className="release-title break-word">{release.title}</h1>
                    <p className="text-muted break-word">
                      {release.artist_name || release.artistName}
                    </p>
                  </div>
                  <StatusBadge status={release.status} />
                </div>

                <dl className="meta-grid">
                  <div className="meta-grid__item">
                    <dt>Type</dt>
                    <dd>{titleCaseStatus(release.release_type || release.releaseType)}</dd>
                  </div>
                  <div className="meta-grid__item">
                    <dt>Genre</dt>
                    <dd>{release.primary_genre || release.primaryGenre || '\u2014'}</dd>
                  </div>
                  <div className="meta-grid__item">
                    <dt>Label</dt>
                    <dd className="break-word">{release.label || 'Self-released'}</dd>
                  </div>
                  <div className="meta-grid__item">
                    <dt>UPC</dt>
                    <dd className="mono">{release.upc || 'Assigned at delivery'}</dd>
                  </div>
                  <div className="meta-grid__item">
                    <dt>Release date</dt>
                    <dd>{formatDate(release.release_date || release.releaseDate)}</dd>
                  </div>
                  <div className="meta-grid__item">
                    <dt>Tracks</dt>
                    <dd className="tabular">{formatNumber(tracks.length)}</dd>
                  </div>
                </dl>

                <div className="cluster">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setDeliverError(null);
                      setDeliverOpen(true);
                    }}
                    disabled={release.status === 'live'}
                  >
                    Deliver to stores
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSaveError(null);
                      setEditing((v) => !v);
                    }}
                  >
                    {editing ? 'Cancel editing' : 'Edit release'}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteOpen(true);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </header>

            {editing ? (
              <Card>
                <CardHeader
                  title="Edit release details"
                  subtitle="Changes apply to future deliveries. Live stores update within 48 hours."
                />
                <CardBody>
                  <ReleaseForm
                    initialValues={initialFormValues}
                    onSubmit={handleSave}
                    submitting={saving}
                    error={saveError}
                    submitLabel="Save changes"
                  />
                </CardBody>
              </Card>
            ) : null}

            <section className="stack">
              <h2>Tracklist</h2>
              <Table
                columns={trackColumns}
                rows={tracks}
                rowKey={(row, i) => row.id ?? `track-${i}`}
                emptyMessage="No tracks have been added to this release yet."
              />
            </section>

            <section className="stack">
              <h2>Store delivery</h2>
              <p className="prose">
                ClaudeSounds delivers your audio, artwork and metadata to each store. Live status
                usually lands within 24&ndash;72 hours of approval.
              </p>
              <Table
                columns={deliveryColumns}
                rows={deliveryRows}
                rowKey={(row, i) => row.id ?? `store-${i}`}
                emptyMessage="This release has not been sent to stores yet."
              />
            </section>

            <section className="stack">
              <h2>Streams, last 30 days</h2>
              <Card>
                <CardBody>
                  <AsyncView
                    loading={seriesLoading}
                    error={seriesError}
                    isEmpty={!seriesLoading && !seriesError && chartData.length === 0}
                    onRetry={loadSeries}
                    emptyTitle="No stream data yet"
                    emptyDescription="Once this release is live on stores, daily stream counts appear here within 48 hours of reporting."
                    skeleton={<div className="skeleton skeleton--chart" />}
                  >
                    <BarChart
                      data={chartData}
                      height={260}
                      ariaLabel={`Daily streams for ${release.title} over the last 30 days`}
                      valueFormatter={(v) => `${formatNumber(v)} streams`}
                    />
                  </AsyncView>
                </CardBody>
              </Card>
            </section>
          </div>
        ) : null}
      </AsyncView>

      <Modal
        open={deliverOpen}
        title="Deliver to stores"
        onClose={() => (delivering ? null : setDeliverOpen(false))}
        footer={
          <div className="cluster cluster--end">
            <Button variant="ghost" onClick={() => setDeliverOpen(false)} disabled={delivering}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleDeliver} loading={delivering}>
              Send for delivery
            </Button>
          </div>
        }
      >
        <div className="stack">
          <p className="prose">
            We&rsquo;ll move <strong className="break-word">{release?.title}</strong> into review and
            queue deliveries to Spotify, Apple Music, Amazon Music, YouTube Music, Deezer and Tidal.
            Metadata is locked while the release is in review.
          </p>
          {deliverError ? (
            <div className="alert alert--danger" role="alert">
              {deliverError}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        title="Delete this release?"
        onClose={() => (deleting ? null : setDeleteOpen(false))}
        footer={
          <div className="cluster cluster--end">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Keep release
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Delete permanently
            </Button>
          </div>
        }
      >
        <div className="stack">
          <p className="prose">
            Deleting removes the release, its tracks, delivery records and stream history from
            ClaudeSounds. Stores already carrying the release will need a separate takedown request.
          </p>
          {deleteError ? (
            <div className="alert alert--danger" role="alert">
              {deleteError}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
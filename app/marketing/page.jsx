'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useRequireAuth from '../../lib/useRequireAuth';
import { campaigns as campaignsApi, releases as releasesApi } from '../../lib/api';
import {
  formatCurrencyFromCents,
  formatCompactNumber,
  formatNumber,
  formatDateRange,
  titleCaseStatus,
} from '../../lib/format';
import CampaignForm from '../../components/marketing/CampaignForm';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import StatCard from '../../components/ui/StatCard';
import AsyncView from '../../components/ui/AsyncView';
import Spinner from '../../components/ui/Spinner';

const CHANNELS = [
  { value: 'all', label: 'All channels' },
  { value: 'playlist_pitch', label: 'Playlist pitching' },
  { value: 'social_ads', label: 'Social ads' },
  { value: 'pr', label: 'PR' },
  { value: 'email', label: 'Email' },
  { value: 'influencer', label: 'Influencer' },
];

function channelLabel(value) {
  const found = CHANNELS.find((c) => c.value === value);
  return found ? found.label : titleCaseStatus(value || '');
}

export default function MarketingPage() {
  const { user, status } = useRequireAuth();

  const [rows, setRows] = useState([]);
  const [releaseOptions, setReleaseOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [channel, setChannel] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignRes, releaseRes] = await Promise.all([
        campaignsApi.list(),
        releasesApi.list().catch(() => ({ releases: [] })),
      ]);
      const list = Array.isArray(campaignRes)
        ? campaignRes
        : campaignRes?.campaigns || [];
      const rels = Array.isArray(releaseRes)
        ? releaseRes
        : releaseRes?.releases || [];
      setRows(list);
      setReleaseOptions(rels);
    } catch (err) {
      setError(
        err && err.message
          ? err.message
          : "We couldn't reach ClaudeSounds — try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let active = true;
    (async () => {
      if (!active) return;
      await load();
    })();
    return () => {
      active = false;
    };
  }, [status, load]);

  const filtered = useMemo(() => {
    if (channel === 'all') return rows;
    return rows.filter((r) => r.channel === channel);
  }, [rows, channel]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.budget += Number(r.budget_cents || 0);
        acc.spend += Number(r.spend_cents || 0);
        acc.impressions += Number(r.impressions || 0);
        acc.clicks += Number(r.clicks || 0);
        return acc;
      },
      { budget: 0, spend: 0, impressions: 0, clicks: 0 }
    );
  }, [filtered]);

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  function openCreate() {
    setEditing(null);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditing(null);
    setFormError('');
  }

  async function handleSubmit(values) {
    setSubmitting(true);
    setFormError('');
    try {
      if (editing) {
        await campaignsApi.update(editing.id, values);
      } else {
        await campaignsApi.create(values);
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(
        err && err.message ? err.message : 'Could not save the campaign. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await campaignsApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteError(
        err && err.message ? err.message : 'Could not delete this campaign. Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Campaign',
        render: (row) => (
          <div className="stack stack--tight">
            <span className="campaign-name">{row.name}</span>
            <span className="text-muted text-xs">{channelLabel(row.channel)}</span>
          </div>
        ),
      },
      {
        key: 'release',
        header: 'Release',
        render: (row) => (
          <span className="release-title">
            {row.release_title || row.releaseTitle || 'Catalogue-wide'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'budget',
        header: 'Budget / spend',
        render: (row) => {
          const budget = Number(row.budget_cents || 0);
          const spend = Number(row.spend_cents || 0);
          const pct = budget > 0 ? Math.min(100, Math.round((spend / budget) * 100)) : 0;
          return (
            <div className="stack stack--tight progress-cell">
              <span className="num">
                {formatCurrencyFromCents(spend)} / {formatCurrencyFromCents(budget)}
              </span>
              <span
                className="progress"
                role="img"
                aria-label={`${pct}% of budget spent`}
              >
                <span
                  className={
                    pct >= 90 ? 'progress__bar progress__bar--warning' : 'progress__bar'
                  }
                  data-pct={pct}
                  style={{ inlineSize: `${pct}%` }}
                />
              </span>
            </div>
          );
        },
      },
      {
        key: 'dates',
        header: 'Schedule',
        render: (row) => (
          <span className="text-muted">
            {formatDateRange(row.start_date, row.end_date)}
          </span>
        ),
      },
      {
        key: 'ctr',
        header: 'CTR',
        align: 'right',
        render: (row) => {
          const impressions = Number(row.impressions || 0);
          const clicks = Number(row.clicks || 0);
          const value = impressions > 0 ? (clicks / impressions) * 100 : 0;
          return (
            <span className="num">
              {value.toFixed(2)}%
              <span className="text-muted text-xs">
                {' '}
                ({formatCompactNumber(clicks)}/{formatCompactNumber(impressions)})
              </span>
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (row) => (
          <div className="cluster cluster--end">
            <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
              Edit
            </Button>
            <Button size="sm" variant="danger" onClick={() => setDeleteTarget(row)}>
              Delete
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  if (status === 'loading' || !user) {
    return (
      <div className="page-loading">
        <Spinner size="lg" label="Loading your marketing campaigns" />
      </div>
    );
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div className="page-header__text prose">
          <h1>Marketing</h1>
          <p>
            Plan, budget and measure every push behind your catalogue — playlist pitches,
            paid social, PR outreach, newsletters and creator collabs — all in one place.
          </p>
        </div>
        <div className="cluster">
          <Button variant="primary" onClick={openCreate}>
            New campaign
          </Button>
        </div>
      </header>

      <section className="grid grid--stats" aria-label="Campaign totals">
        <StatCard
          label="Total budget"
          value={formatCurrencyFromCents(totals.budget)}
          hint={`${formatNumber(filtered.length)} campaign${filtered.length === 1 ? '' : 's'}`}
          loading={loading}
        />
        <StatCard
          label="Spend to date"
          value={formatCurrencyFromCents(totals.spend)}
          hint={
            totals.budget > 0
              ? `${Math.round((totals.spend / totals.budget) * 100)}% of budget used`
              : 'No budget allocated yet'
          }
          loading={loading}
        />
        <StatCard
          label="Impressions"
          value={formatCompactNumber(totals.impressions)}
          hint={`${formatCompactNumber(totals.clicks)} clicks`}
          loading={loading}
        />
        <StatCard
          label="Click-through rate"
          value={`${ctr.toFixed(2)}%`}
          hint="Clicks divided by impressions"
          loading={loading}
        />
      </section>

      <section className="stack" aria-label="Campaigns">
        <h2>All campaigns</h2>
        <div className="cluster toolbar" role="group" aria-label="Filter by channel">
          {CHANNELS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={channel === option.value ? 'primary' : 'ghost'}
              onClick={() => setChannel(option.value)}
              aria-pressed={channel === option.value}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <AsyncView
          loading={loading}
          error={error}
          isEmpty={!loading && !error && filtered.length === 0}
          onRetry={load}
          emptyTitle={
            channel === 'all' ? 'No campaigns yet' : 'No campaigns on this channel'
          }
          emptyDescription={
            channel === 'all'
              ? 'Create your first campaign to track budget, spend and click-through across your marketing channels.'
              : 'Try another channel filter, or start a new campaign on this one.'
          }
          emptyAction={
            <Button variant="primary" onClick={openCreate}>
              New campaign
            </Button>
          }
        >
          <Table
            columns={columns}
            rows={filtered}
            rowKey={(row) => row.id}
            emptyMessage="No campaigns to show."
            skeletonRows={5}
          />
        </AsyncView>
      </section>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit campaign' : 'New campaign'}
        onClose={closeModal}
      >
        <CampaignForm
          releases={releaseOptions}
          initialValues={editing || undefined}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={formError}
        />
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete campaign"
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError('');
          }
        }}
        footer={
          <div className="cluster cluster--end">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError('');
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Delete campaign
            </Button>
          </div>
        }
      >
        <div className="prose">
          <p>
            Deleting <strong className="campaign-name">{deleteTarget?.name}</strong> removes
            its budget, spend and performance history from ClaudeSounds. This cannot be
            undone.
          </p>
          {deleteError ? (
            <p className="form-error" role="alert">
              {deleteError}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
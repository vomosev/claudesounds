'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useRequireAuth from '../../lib/useRequireAuth';
import { releases as releasesApi } from '../../lib/api';
import ReleaseCard from '../../components/releases/ReleaseCard';
import AsyncView from '../../components/ui/AsyncView';
import Field, { Input, Select } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'live', label: 'Live' },
  { value: 'takedown', label: 'Taken down' }
];

function ReleaseGridSkeleton() {
  return (
    <div className="grid grid--releases" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="card skeleton-card">
          <div className="skeleton skeleton--art" />
          <div className="stack stack--sm">
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line skeleton--short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReleasesPage() {
  const { status: authStatus } = useRequireAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError(null);
      try {
        const data = await releasesApi.list(
          { status: statusFilter || undefined, search: search.trim() || undefined },
          { signal }
        );
        const list = Array.isArray(data) ? data : Array.isArray(data?.releases) ? data.releases : [];
        setItems(list);
      } catch (err) {
        if (err && (err.name === 'AbortError' || err.code === 20)) return;
        setError(
          err && err.message
            ? err.message
            : "We couldn't reach ClaudeSounds — try again in a moment."
        );
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter]
  );

  useEffect(() => {
    if (authStatus !== 'authenticated') return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      load(controller.signal);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [authStatus, load, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const hasFilters = useMemo(
    () => Boolean(search.trim() || statusFilter),
    [search, statusFilter]
  );

  if (authStatus === 'loading') {
    return (
      <div className="page-center">
        <Spinner size="lg" label="Checking your session" />
      </div>
    );
  }

  if (authStatus !== 'authenticated') {
    return null;
  }

  return (
    <section className="page">
      <header className="page-head">
        <div className="page-head__text">
          <h1>Releases</h1>
          <p className="prose">
            Every single, EP and album in your catalogue. Create a release, add your tracks and
            deliver it to Spotify, Apple Music and the rest of the stores in one step.
          </p>
        </div>
        <Button as="link" href="/releases/new" variant="primary" size="md">
          New release
        </Button>
      </header>

      <div className="toolbar">
        <Field label="Search catalogue" htmlFor="release-search" hint="Title, artist or label">
          <Input
            id="release-search"
            type="search"
            name="search"
            value={search}
            placeholder="e.g. Midnight Frequencies"
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Status" htmlFor="release-status">
          <Select
            id="release-status"
            name="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
        {hasFilters ? (
          <div className="toolbar__action">
            <Button
              variant="ghost"
              size="md"
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : null}
      </div>

      <AsyncView
        loading={loading}
        error={error}
        isEmpty={!loading && !error && items.length === 0}
        onRetry={retry}
        skeleton={<ReleaseGridSkeleton />}
        emptyTitle={hasFilters ? 'No releases match those filters' : 'No releases yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different search term or reset the status filter to see your whole catalogue.'
            : 'Start by creating your first release — add artwork colour, tracks and metadata, then deliver it to the stores.'
        }
        emptyAction={
          hasFilters ? (
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Button as="link" href="/releases/new" variant="primary" size="md">
              Create your first release
            </Button>
          )
        }
      >
        <div className="grid grid--releases">
          {items.map((release) => (
            <ReleaseCard key={release.id} release={release} />
          ))}
        </div>
      </AsyncView>
    </section>
  );
}
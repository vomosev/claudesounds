'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useRequireAuth from '../../../lib/useRequireAuth';
import { releases as releasesApi } from '../../../lib/api';
import ReleaseForm from '../../../components/releases/ReleaseForm';
import Card, { CardBody, CardHeader } from '../../../components/ui/Card';
import Spinner from '../../../components/ui/Spinner';

export default function NewReleasePage() {
  const { status } = useRequireAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(values) {
    setSubmitting(true);
    setError('');
    try {
      const created = await releasesApi.create(values);
      const id = created?.release?.id ?? created?.id;
      if (id) {
        router.push(`/releases/${id}`);
      } else {
        router.push('/releases');
      }
    } catch (err) {
      setError(
        err && err.message
          ? err.message
          : "We couldn't save this release — try again in a moment."
      );
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="page-loading">
        <Spinner size="lg" label="Loading your account" />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <div className="stack stack--lg">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/releases">Releases</Link>
        <span aria-hidden="true" className="breadcrumb__sep">
          /
        </span>
        <span className="breadcrumb__current">New release</span>
      </nav>

      <header className="prose">
        <h1>Create a new release</h1>
        <p>
          Add your metadata and tracklist here. Once the release is saved as a draft
          you can deliver it to Spotify, Apple Music, Amazon Music, YouTube Music,
          Deezer and Tidal from the release page. Accurate titles, ISRCs and
          songwriter credits speed up store review considerably.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Release details"
          subtitle="Fields marked required must be completed before you can save."
        />
        <CardBody>
          {error ? (
            <div className="alert alert--danger" role="alert">
              <strong>Could not save release.</strong>
              <span className="break-word">{error}</span>
            </div>
          ) : null}
          <ReleaseForm
            onSubmit={handleSubmit}
            submitting={submitting}
            error={error}
            submitLabel="Save draft release"
          />
        </CardBody>
      </Card>
    </div>
  );
}
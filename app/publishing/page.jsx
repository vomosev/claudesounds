'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useRequireAuth from '../../lib/useRequireAuth';
import { publishing } from '../../lib/api';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Field, { Input, Select } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import AsyncView from '../../components/ui/AsyncView';
import Spinner from '../../components/ui/Spinner';
import { formatDate, formatNumber } from '../../lib/format';

const SOCIETIES = [
  'ASCAP',
  'BMI',
  'SESAC',
  'PRS for Music',
  'GEMA',
  'SACEM',
  'SOCAN',
  'APRA AMCOS'
];

const ROLES = [
  { value: 'composer', label: 'Composer' },
  { value: 'lyricist', label: 'Lyricist' },
  { value: 'arranger', label: 'Arranger' },
  { value: 'publisher', label: 'Publisher' }
];

const NEXT_STATUS = {
  unregistered: 'submitted',
  submitted: 'registered'
};

const NEXT_STATUS_LABEL = {
  unregistered: 'Submit to society',
  submitted: 'Mark registered'
};

function emptySplit() {
  return { writerName: '', role: 'composer', sharePercent: '' };
}

function blankForm() {
  return {
    workTitle: '',
    iswc: '',
    society: 'ASCAP',
    trackId: '',
    splits: [{ writerName: '', role: 'composer', sharePercent: '100' }]
  };
}

export default function PublishingPage() {
  const { status: authStatus } = useRequireAuth();

  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [advancingId, setAdvancingId] = useState(null);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await publishing.listWorks();
      const list = Array.isArray(data) ? data : data?.works || [];
      setWorks(list);
    } catch (err) {
      setError(
        err && err.status === 401
          ? 'Your session has expired. Please log in again.'
          : "We couldn't reach ClaudeSounds — try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    loadWorks();
  }, [authStatus, loadWorks]);

  const stats = useMemo(() => {
    const registered = works.filter((w) => w.registration_status === 'registered').length;
    const pending = works.filter(
      (w) => w.registration_status === 'submitted' || w.registration_status === 'unregistered'
    ).length;
    const writers = works.reduce((sum, w) => sum + Number(w.writer_count || 0), 0);
    return { registered, pending, writers };
  }, [works]);

  const splitTotal = useMemo(
    () =>
      form.splits.reduce((sum, s) => {
        const n = Number.parseFloat(s.sharePercent);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [form.splits]
  );

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function updateSplit(index, key, value) {
    setForm((prev) => {
      const splits = prev.splits.map((s, i) => (i === index ? { ...s, [key]: value } : s));
      return { ...prev, splits };
    });
  }

  function addSplit() {
    setForm((prev) => ({ ...prev, splits: [...prev.splits, emptySplit()] }));
  }

  function removeSplit(index) {
    setForm((prev) => ({
      ...prev,
      splits: prev.splits.length > 1 ? prev.splits.filter((_, i) => i !== index) : prev.splits
    }));
  }

  function openModal() {
    setForm(blankForm());
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
  }

  function validate() {
    const errors = {};
    if (!form.workTitle.trim()) errors.workTitle = 'Work title is required.';
    if (form.workTitle.trim().length > 200) errors.workTitle = 'Keep the title under 200 characters.';
    if (form.iswc.trim() && !/^T-?\d{3}\.?\d{3}\.?\d{3}-?\d$/i.test(form.iswc.trim())) {
      errors.iswc = 'Use an ISWC like T-123.456.789-0, or leave it blank.';
    }
    if (form.trackId.trim() && !/^\d+$/.test(form.trackId.trim())) {
      errors.trackId = 'Track ID must be a number.';
    }
    form.splits.forEach((split, i) => {
      if (!split.writerName.trim()) errors[`split-name-${i}`] = 'Writer name is required.';
      const share = Number.parseFloat(split.sharePercent);
      if (!Number.isFinite(share) || share <= 0 || share > 100) {
        errors[`split-share-${i}`] = 'Enter a share between 0.01 and 100.';
      }
    });
    if (Math.abs(splitTotal - 100) > 0.01) {
      errors.splits = `Splits must total exactly 100% — currently ${splitTotal.toFixed(2)}%.`;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await publishing.createWork({
        workTitle: form.workTitle.trim(),
        iswc: form.iswc.trim() || null,
        society: form.society || null,
        trackId: form.trackId.trim() ? Number(form.trackId.trim()) : null,
        splits: form.splits.map((s) => ({
          writerName: s.writerName.trim(),
          role: s.role,
          sharePercent: Number.parseFloat(s.sharePercent)
        }))
      });
      setModalOpen(false);
      await loadWorks();
    } catch (err) {
      setSubmitError(
        (err && err.message) || "We couldn't register that work — try again in a moment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function advanceStatus(work) {
    const next = NEXT_STATUS[work.registration_status];
    if (!next) return;
    setAdvancingId(work.id);
    try {
      await publishing.updateWork(work.id, { registrationStatus: next });
      setWorks((prev) =>
        prev.map((w) => (w.id === work.id ? { ...w, registration_status: next } : w))
      );
    } catch (err) {
      setError(
        (err && err.message) || "We couldn't update that registration — try again in a moment."
      );
    } finally {
      setAdvancingId(null);
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'work_title',
        header: 'Work',
        render: (row) => (
          <div className="stack stack--tight">
            <span className="release-title">{row.work_title}</span>
            <span className="text-muted text-xs">{row.iswc || 'No ISWC yet'}</span>
          </div>
        )
      },
      {
        key: 'society',
        header: 'Society',
        render: (row) => row.society || '—'
      },
      {
        key: 'writer_count',
        header: 'Writers',
        align: 'right',
        render: (row) => formatNumber(Number(row.writer_count || 0))
      },
      {
        key: 'total_share',
        header: 'Splits',
        align: 'right',
        render: (row) => `${Number(row.total_share || 0).toFixed(2)}%`
      },
      {
        key: 'registration_status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.registration_status} />
      },
      {
        key: 'created_at',
        header: 'Created',
        render: (row) => (row.created_at ? formatDate(row.created_at) : '—')
      },
      {
        key: 'actions',
        header: 'Action',
        align: 'right',
        render: (row) =>
          NEXT_STATUS[row.registration_status] ? (
            <Button
              size="sm"
              variant="ghost"
              loading={advancingId === row.id}
              onClick={() => advanceStatus(row)}
            >
              {NEXT_STATUS_LABEL[row.registration_status]}
            </Button>
          ) : (
            <span className="text-muted text-xs">Registered</span>
          )
      }
    ],
    [advancingId]
  );

  if (authStatus === 'loading') {
    return (
      <div className="page-loading">
        <Spinner size="lg" label="Loading your publishing catalogue" />
      </div>
    );
  }

  if (authStatus !== 'authenticated') return null;

  return (
    <div className="stack">
      <header className="page-header">
        <div className="page-header__text prose">
          <h1>Publishing</h1>
          <p>
            Register your compositions with a performing rights society, keep writer splits
            accurate and make sure every songwriter on a record gets paid. Splits must total
            exactly 100% before a work can be submitted.
          </p>
        </div>
        <div className="cluster">
          <Button variant="primary" onClick={openModal}>
            Register work
          </Button>
        </div>
      </header>

      <section className="grid grid--stats" aria-label="Publishing summary">
        <StatCard
          label="Registered works"
          value={formatNumber(stats.registered)}
          hint="Confirmed by your society"
          loading={loading}
        />
        <StatCard
          label="Pending registrations"
          value={formatNumber(stats.pending)}
          hint="Submitted or not yet filed"
          loading={loading}
        />
        <StatCard
          label="Credited writers"
          value={formatNumber(stats.writers)}
          hint="Across all registered works"
          loading={loading}
        />
      </section>

      <section aria-label="Registered works">
        <h2>Your works</h2>
        <AsyncView
          loading={loading}
          error={error}
          isEmpty={!loading && !error && works.length === 0}
          onRetry={loadWorks}
          emptyTitle="No publishing works yet"
          emptyDescription="A publishing work is the underlying composition behind a recording. Register one here, add each songwriter's share, then submit it to your society to start collecting performance and mechanical royalties."
          emptyAction={
            <Button variant="primary" onClick={openModal}>
              Register your first work
            </Button>
          }
        >
          <Table
            columns={columns}
            rows={works}
            rowKey={(row) => row.id}
            loading={loading}
            skeletonRows={5}
            emptyMessage="No works match this view."
          />
        </AsyncView>
      </section>

      <Modal
        open={modalOpen}
        title="Register a publishing work"
        onClose={closeModal}
        footer={
          <div className="cluster cluster--end">
            <Button variant="ghost" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="publishing-work-form"
              loading={submitting}
            >
              Register work
            </Button>
          </div>
        }
      >
        <form id="publishing-work-form" className="stack" onSubmit={handleSubmit} noValidate>
          {submitError ? (
            <p className="error-panel" role="alert">
              {submitError}
            </p>
          ) : null}

          <Field
            label="Work title"
            htmlFor="workTitle"
            required
            error={formErrors.workTitle}
            hint="The composition title, which may differ from the recording title."
          >
            <Input
              id="workTitle"
              name="workTitle"
              value={form.workTitle}
              onChange={(e) => updateField('workTitle', e.target.value)}
              error={formErrors.workTitle}
              placeholder="Midnight Reprise"
              autoComplete="off"
            />
          </Field>

          <div className="grid grid--two">
            <Field label="ISWC" htmlFor="iswc" error={formErrors.iswc} hint="Optional until your society assigns one.">
              <Input
                id="iswc"
                name="iswc"
                value={form.iswc}
                onChange={(e) => updateField('iswc', e.target.value)}
                error={formErrors.iswc}
                placeholder="T-123.456.789-0"
                autoComplete="off"
              />
            </Field>

            <Field label="Society" htmlFor="society">
              <Select
                id="society"
                name="society"
                value={form.society}
                onChange={(e) => updateField('society', e.target.value)}
              >
                {SOCIETIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Linked track ID"
            htmlFor="trackId"
            error={formErrors.trackId}
            hint="Optional — connect this work to a track from one of your releases."
          >
            <Input
              id="trackId"
              name="trackId"
              inputMode="numeric"
              value={form.trackId}
              onChange={(e) => updateField('trackId', e.target.value)}
              error={formErrors.trackId}
              placeholder="e.g. 42"
            />
          </Field>

          <fieldset className="fieldset">
            <legend className="fieldset__legend">Writer splits</legend>
            <div className="stack">
              {form.splits.map((split, index) => (
                <div className="split-row grid grid--split" key={`split-${index}`}>
                  <Field
                    label="Writer"
                    htmlFor={`split-name-${index}`}
                    required
                    error={formErrors[`split-name-${index}`]}
                  >
                    <Input
                      id={`split-name-${index}`}
                      value={split.writerName}
                      onChange={(e) => updateSplit(index, 'writerName', e.target.value)}
                      error={formErrors[`split-name-${index}`]}
                      placeholder="Nadia Okonkwo"
                      autoComplete="off"
                    />
                  </Field>

                  <Field label="Role" htmlFor={`split-role-${index}`}>
                    <Select
                      id={`split-role-${index}`}
                      value={split.role}
                      onChange={(e) => updateSplit(index, 'role', e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="Share %"
                    htmlFor={`split-share-${index}`}
                    required
                    error={formErrors[`split-share-${index}`]}
                  >
                    <Input
                      id={`split-share-${index}`}
                      inputMode="decimal"
                      value={split.sharePercent}
                      onChange={(e) => updateSplit(index, 'sharePercent', e.target.value)}
                      error={formErrors[`split-share-${index}`]}
                      placeholder="50"
                    />
                  </Field>

                  <div className="split-row__action">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSplit(index)}
                      disabled={form.splits.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}

              <div className="cluster cluster--between">
                <Button variant="secondary" size="sm" onClick={addSplit}>
                  Add writer
                </Button>
                <span
                  className={
                    Math.abs(splitTotal - 100) > 0.01 ? 'split-total split-total--bad' : 'split-total'
                  }
                >
                  Total: {splitTotal.toFixed(2)}%
                </span>
              </div>

              {formErrors.splits ? (
                <p className="field__error" role="alert">
                  {formErrors.splits}
                </p>
              ) : null}
            </div>
          </fieldset>
        </form>
      </Modal>
    </div>
  );
}
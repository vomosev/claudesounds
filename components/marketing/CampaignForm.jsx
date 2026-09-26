'use client';

import { useMemo, useState } from 'react';
import Field, { Input, Select } from '../ui/Field';
import Button from '../ui/Button';

const CHANNELS = [
  { value: 'playlist_pitch', label: 'Playlist pitching' },
  { value: 'social_ads', label: 'Social ads' },
  { value: 'pr', label: 'PR' },
  { value: 'email', label: 'Email' },
  { value: 'influencer', label: 'Influencer' },
];

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'running', label: 'Running' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

function todayIso() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function toDateInput(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export default function CampaignForm({
  releases = [],
  initialValues = null,
  onSubmit,
  submitting = false,
  error = null,
  submitLabel = 'Save campaign',
  onCancel,
}) {
  const defaults = useMemo(() => {
    const iv = initialValues || {};
    const budgetCents =
      iv.budgetCents != null ? iv.budgetCents : iv.budget_cents != null ? iv.budget_cents : null;
    const spendCents =
      iv.spendCents != null ? iv.spendCents : iv.spend_cents != null ? iv.spend_cents : null;
    return {
      name: iv.name || '',
      channel: iv.channel || 'playlist_pitch',
      releaseId:
        iv.releaseId != null
          ? String(iv.releaseId)
          : iv.release_id != null
            ? String(iv.release_id)
            : '',
      budget: budgetCents != null ? (Number(budgetCents) / 100).toFixed(2) : '',
      spend: spendCents != null ? (Number(spendCents) / 100).toFixed(2) : '',
      status: iv.status || 'draft',
      startDate: toDateInput(iv.startDate || iv.start_date) || todayIso(),
      endDate: toDateInput(iv.endDate || iv.end_date) || '',
    };
  }, [initialValues]);

  const [values, setValues] = useState(defaults);
  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(v) {
    const next = {};
    const name = v.name.trim();
    if (!name) next.name = 'Give the campaign a name your team will recognise.';
    else if (name.length > 120) next.name = 'Keep the name under 120 characters.';

    if (!CHANNELS.some((c) => c.value === v.channel)) next.channel = 'Choose a marketing channel.';
    if (!STATUSES.some((s) => s.value === v.status)) next.status = 'Choose a campaign status.';

    const budget = Number(v.budget);
    if (v.budget === '' || Number.isNaN(budget)) next.budget = 'Enter a budget in dollars.';
    else if (budget < 0) next.budget = 'Budget cannot be negative.';
    else if (budget > 1000000) next.budget = 'Budget must be under $1,000,000.';

    if (v.spend !== '') {
      const spend = Number(v.spend);
      if (Number.isNaN(spend) || spend < 0) next.spend = 'Enter spend to date in dollars.';
      else if (!next.budget && spend > budget) next.spend = 'Spend is higher than the budget.';
    }

    if (!v.startDate) next.startDate = 'Pick a start date.';
    if (!v.endDate) next.endDate = 'Pick an end date.';
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
      next.endDate = 'The end date must fall on or after the start date.';
    }
    return next;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (typeof onSubmit !== 'function') return;

    onSubmit({
      name: values.name.trim(),
      channel: values.channel,
      releaseId: values.releaseId ? Number(values.releaseId) : null,
      budget: Number(values.budget),
      spend: values.spend === '' ? 0 : Number(values.spend),
      status: values.status,
      startDate: values.startDate,
      endDate: values.endDate,
    });
  }

  return (
    <form className="stack campaign-form" onSubmit={handleSubmit} noValidate>
      {error ? (
        <div className="alert alert--danger" role="alert">
          <p>{typeof error === 'string' ? error : error.message || 'Something went wrong.'}</p>
        </div>
      ) : null}

      <Field label="Campaign name" htmlFor="campaign-name" error={errors.name} required>
        <Input
          id="campaign-name"
          name="name"
          value={values.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Midnight Signal — release week push"
          autoComplete="off"
          error={errors.name}
          disabled={submitting}
        />
      </Field>

      <div className="grid grid--2">
        <Field label="Channel" htmlFor="campaign-channel" error={errors.channel} required>
          <Select
            id="campaign-channel"
            name="channel"
            value={values.channel}
            onChange={(e) => setField('channel', e.target.value)}
            error={errors.channel}
            disabled={submitting}
          >
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Linked release"
          htmlFor="campaign-release"
          hint="Optional — attach the release this campaign promotes."
        >
          <Select
            id="campaign-release"
            name="releaseId"
            value={values.releaseId}
            onChange={(e) => setField('releaseId', e.target.value)}
            disabled={submitting}
          >
            <option value="">No linked release</option>
            {releases.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.title}
                {r.artist_name ? ` — ${r.artist_name}` : ''}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid--2">
        <Field
          label="Budget (USD)"
          htmlFor="campaign-budget"
          error={errors.budget}
          hint="Total planned spend for the campaign."
          required
        >
          <Input
            id="campaign-budget"
            name="budget"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={values.budget}
            onChange={(e) => setField('budget', e.target.value)}
            placeholder="1500.00"
            error={errors.budget}
            disabled={submitting}
          />
        </Field>

        <Field label="Spend to date (USD)" htmlFor="campaign-spend" error={errors.spend}>
          <Input
            id="campaign-spend"
            name="spend"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={values.spend}
            onChange={(e) => setField('spend', e.target.value)}
            placeholder="0.00"
            error={errors.spend}
            disabled={submitting}
          />
        </Field>
      </div>

      <div className="grid grid--2">
        <Field label="Start date" htmlFor="campaign-start" error={errors.startDate} required>
          <Input
            id="campaign-start"
            name="startDate"
            type="date"
            value={values.startDate}
            onChange={(e) => setField('startDate', e.target.value)}
            error={errors.startDate}
            disabled={submitting}
          />
        </Field>

        <Field label="End date" htmlFor="campaign-end" error={errors.endDate} required>
          <Input
            id="campaign-end"
            name="endDate"
            type="date"
            value={values.endDate}
            min={values.startDate || undefined}
            onChange={(e) => setField('endDate', e.target.value)}
            error={errors.endDate}
            disabled={submitting}
          />
        </Field>
      </div>

      <Field label="Status" htmlFor="campaign-status" error={errors.status} required>
        <Select
          id="campaign-status"
          name="status"
          value={values.status}
          onChange={(e) => setField('status', e.target.value)}
          error={errors.status}
          disabled={submitting}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="cluster cluster--end form-actions">
        {typeof onCancel === 'function' ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
'use client';

import { useMemo, useState } from 'react';
import Field, { Input, Select, Textarea } from '../ui/Field';
import Button from '../ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';

const RELEASE_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'ep', label: 'EP' },
  { value: 'album', label: 'Album' },
];

const GENRES = [
  'Alternative',
  'Ambient',
  'Classical',
  'Country',
  'Dance / Electronic',
  'Folk',
  'Hip-Hop / Rap',
  'Indie Pop',
  'Jazz',
  'Latin',
  'Metal',
  'Pop',
  'R&B / Soul',
  'Reggae',
  'Rock',
  'Soundtrack',
  'World',
];

const ARTWORK_COLORS = [
  { value: 'amber', label: 'Amber' },
  { value: 'violet', label: 'Violet' },
  { value: 'teal', label: 'Teal' },
  { value: 'rose', label: 'Rose' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'lime', label: 'Lime' },
];

function emptyTrack(number) {
  return {
    key: `track-${number}-${Math.random().toString(36).slice(2, 8)}`,
    trackNumber: number,
    title: '',
    isrc: '',
    duration: '',
    explicit: false,
    songwriters: '',
  };
}

function secondsToMmSs(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return '';
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function mmSsToSeconds(value) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function todayIso() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function normaliseDate(value) {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export default function ReleaseForm({
  initialValues = null,
  onSubmit,
  submitting = false,
  error = null,
  submitLabel = 'Save release',
}) {
  const initialTracks = useMemo(() => {
    const source = Array.isArray(initialValues?.tracks) ? initialValues.tracks : [];
    if (source.length === 0) return [emptyTrack(1)];
    return source.map((track, index) => ({
      key: `track-${track.id ?? index}-${index}`,
      trackNumber: track.track_number ?? track.trackNumber ?? index + 1,
      title: track.title ?? '',
      isrc: track.isrc ?? '',
      duration: secondsToMmSs(track.duration_seconds ?? track.durationSeconds),
      explicit: Boolean(track.explicit),
      songwriters: track.songwriters ?? '',
    }));
  }, [initialValues]);

  const [values, setValues] = useState(() => ({
    title: initialValues?.title ?? '',
    artistName: initialValues?.artist_name ?? initialValues?.artistName ?? '',
    releaseType: initialValues?.release_type ?? initialValues?.releaseType ?? 'single',
    primaryGenre: initialValues?.primary_genre ?? initialValues?.primaryGenre ?? 'Indie Pop',
    label: initialValues?.label ?? '',
    upc: initialValues?.upc ?? '',
    releaseDate: normaliseDate(initialValues?.release_date ?? initialValues?.releaseDate) || todayIso(),
    artworkColor: initialValues?.artwork_color ?? initialValues?.artworkColor ?? 'amber',
  }));

  const [tracks, setTracks] = useState(initialTracks);
  const [errors, setErrors] = useState({});
  const [trackErrors, setTrackErrors] = useState({});

  const setField = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const setTrackField = (key, name, value) => {
    setTracks((prev) =>
      prev.map((track) => (track.key === key ? { ...track, [name]: value } : track)),
    );
    setTrackErrors((prev) => {
      if (!prev[key] || !prev[key][name]) return prev;
      const nextForTrack = { ...prev[key] };
      delete nextForTrack[name];
      const next = { ...prev, [key]: nextForTrack };
      if (Object.keys(nextForTrack).length === 0) delete next[key];
      return next;
    });
  };

  const addTrack = () => {
    setTracks((prev) => [...prev, emptyTrack(prev.length + 1)]);
  };

  const removeTrack = (key) => {
    setTracks((prev) => {
      const next = prev.filter((track) => track.key !== key);
      const rebuilt = (next.length ? next : [emptyTrack(1)]).map((track, index) => ({
        ...track,
        trackNumber: index + 1,
      }));
      return rebuilt;
    });
    setTrackErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const nextErrors = {};
    const nextTrackErrors = {};

    if (!values.title.trim()) nextErrors.title = 'Give your release a title.';
    else if (values.title.trim().length > 200) nextErrors.title = 'Keep the title under 200 characters.';

    if (!values.artistName.trim()) nextErrors.artistName = 'Tell us which artist this release belongs to.';

    if (!RELEASE_TYPES.some((t) => t.value === values.releaseType)) {
      nextErrors.releaseType = 'Choose a release type.';
    }

    if (!values.primaryGenre) nextErrors.primaryGenre = 'Choose a primary genre.';

    if (values.upc && !/^\d{12,14}$/.test(values.upc.trim())) {
      nextErrors.upc = 'A UPC is 12–14 digits. Leave it blank and we will assign one.';
    }

    if (!values.releaseDate) {
      nextErrors.releaseDate = 'Pick a release date.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.releaseDate)) {
      nextErrors.releaseDate = 'Use the date picker to choose a valid date.';
    }

    tracks.forEach((track) => {
      const trackError = {};
      if (!track.title.trim()) trackError.title = 'Track title is required.';
      if (track.isrc && !/^[A-Za-z]{2}[A-Za-z0-9]{3}\d{7}$/.test(track.isrc.trim())) {
        trackError.isrc = 'ISRC looks like USRC17607839.';
      }
      if (track.duration && mmSsToSeconds(track.duration) === null) {
        trackError.duration = 'Use mm:ss, e.g. 3:42.';
      }
      if (Object.keys(trackError).length) nextTrackErrors[track.key] = trackError;
    });

    setErrors(nextErrors);
    setTrackErrors(nextTrackErrors);
    return Object.keys(nextErrors).length === 0 && Object.keys(nextTrackErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    const payload = {
      title: values.title.trim(),
      artistName: values.artistName.trim(),
      releaseType: values.releaseType,
      primaryGenre: values.primaryGenre,
      label: values.label.trim() || null,
      upc: values.upc.trim() || null,
      releaseDate: values.releaseDate,
      artworkColor: values.artworkColor,
      tracks: tracks.map((track, index) => ({
        trackNumber: index + 1,
        title: track.title.trim(),
        isrc: track.isrc.trim() || null,
        durationSeconds: mmSsToSeconds(track.duration),
        explicit: track.explicit ? 1 : 0,
        songwriters: track.songwriters.trim() || null,
      })),
    };

    if (typeof onSubmit === 'function') onSubmit(payload);
  };

  return (
    <form className="release-form stack" onSubmit={handleSubmit} noValidate>
      {error ? (
        <div className="alert alert--danger" role="alert">
          <strong>We couldn&rsquo;t save this release.</strong>
          <span className="break-word">{typeof error === 'string' ? error : error.message}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Release details"
          subtitle="This metadata is delivered to every store exactly as you type it."
        />
        <CardBody>
          <div className="form-grid">
            <Field
              label="Release title"
              htmlFor="release-title"
              required
              error={errors.title}
              hint="The title as it should appear on Spotify and Apple Music."
            >
              <Input
                id="release-title"
                name="title"
                value={values.title}
                error={errors.title}
                placeholder="Midnight Harbour"
                autoComplete="off"
                onChange={(e) => setField('title', e.target.value)}
              />
            </Field>

            <Field label="Artist name" htmlFor="release-artist" required error={errors.artistName}>
              <Input
                id="release-artist"
                name="artistName"
                value={values.artistName}
                error={errors.artistName}
                placeholder="Nova Pierce"
                autoComplete="off"
                onChange={(e) => setField('artistName', e.target.value)}
              />
            </Field>

            <Field label="Release type" htmlFor="release-type" required error={errors.releaseType}>
              <Select
                id="release-type"
                name="releaseType"
                value={values.releaseType}
                error={errors.releaseType}
                onChange={(e) => setField('releaseType', e.target.value)}
              >
                {RELEASE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Primary genre" htmlFor="release-genre" required error={errors.primaryGenre}>
              <Select
                id="release-genre"
                name="primaryGenre"
                value={values.primaryGenre}
                error={errors.primaryGenre}
                onChange={(e) => setField('primaryGenre', e.target.value)}
              >
                {GENRES.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Label"
              htmlFor="release-label"
              hint="Leave blank to release under your own name."
            >
              <Input
                id="release-label"
                name="label"
                value={values.label}
                placeholder="Harbour Lights Records"
                autoComplete="off"
                onChange={(e) => setField('label', e.target.value)}
              />
            </Field>

            <Field
              label="UPC"
              htmlFor="release-upc"
              hint="Already have a barcode? Add it here, otherwise we assign one free."
              error={errors.upc}
            >
              <Input
                id="release-upc"
                name="upc"
                inputMode="numeric"
                value={values.upc}
                error={errors.upc}
                placeholder="602438119042"
                autoComplete="off"
                onChange={(e) => setField('upc', e.target.value)}
              />
            </Field>

            <Field
              label="Release date"
              htmlFor="release-date"
              required
              error={errors.releaseDate}
              hint="Allow at least 14 days for playlist pitching."
            >
              <Input
                id="release-date"
                name="releaseDate"
                type="date"
                value={values.releaseDate}
                error={errors.releaseDate}
                onChange={(e) => setField('releaseDate', e.target.value)}
              />
            </Field>

            <Field
              label="Artwork accent"
              htmlFor="release-artwork-amber"
              hint="Sets the gradient used for this release across ClaudeSounds."
            >
              <div className="swatch-row cluster" role="radiogroup" aria-label="Artwork accent colour">
                {ARTWORK_COLORS.map((colour) => (
                  <label
                    key={colour.value}
                    className={
                      values.artworkColor === colour.value
                        ? 'swatch swatch--selected'
                        : 'swatch'
                    }
                    data-color={colour.value}
                  >
                    <input
                      id={`release-artwork-${colour.value}`}
                      type="radio"
                      name="artworkColor"
                      className="swatch__input"
                      value={colour.value}
                      checked={values.artworkColor === colour.value}
                      onChange={() => setField('artworkColor', colour.value)}
                    />
                    <span className={`swatch__chip artwork-${colour.value}`} aria-hidden="true" />
                    <span className="swatch__label">{colour.label}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Track list"
          subtitle="Add every track in running order. Songwriters feed straight into publishing."
          actions={
            <Button type="button" variant="secondary" size="sm" onClick={addTrack}>
              Add track
            </Button>
          }
        />
        <CardBody>
          <div className="track-rows">
            {tracks.map((track, index) => {
              const rowErrors = trackErrors[track.key] || {};
              return (
                <div className="track-row" key={track.key}>
                  <div className="track-row__head">
                    <span className="track-row__number">Track {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTrack(track.key)}
                      disabled={tracks.length === 1 && !track.title}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="form-grid">
                    <Field
                      label="Track title"
                      htmlFor={`${track.key}-title`}
                      required
                      error={rowErrors.title}
                    >
                      <Input
                        id={`${track.key}-title`}
                        value={track.title}
                        error={rowErrors.title}
                        placeholder="Signal Fires"
                        autoComplete="off"
                        onChange={(e) => setTrackField(track.key, 'title', e.target.value)}
                      />
                    </Field>

                    <Field
                      label="ISRC"
                      htmlFor={`${track.key}-isrc`}
                      hint="Optional — we generate one if you leave it empty."
                      error={rowErrors.isrc}
                    >
                      <Input
                        id={`${track.key}-isrc`}
                        value={track.isrc}
                        error={rowErrors.isrc}
                        placeholder="USRC17607839"
                        autoComplete="off"
                        onChange={(e) => setTrackField(track.key, 'isrc', e.target.value)}
                      />
                    </Field>

                    <Field
                      label="Duration"
                      htmlFor={`${track.key}-duration`}
                      hint="Format mm:ss"
                      error={rowErrors.duration}
                    >
                      <Input
                        id={`${track.key}-duration`}
                        value={track.duration}
                        error={rowErrors.duration}
                        placeholder="3:42"
                        inputMode="numeric"
                        autoComplete="off"
                        onChange={(e) => setTrackField(track.key, 'duration', e.target.value)}
                      />
                    </Field>

                    <Field label="Explicit content" htmlFor={`${track.key}-explicit`}>
                      <label className="checkbox" htmlFor={`${track.key}-explicit`}>
                        <input
                          id={`${track.key}-explicit`}
                          type="checkbox"
                          checked={track.explicit}
                          onChange={(e) => setTrackField(track.key, 'explicit', e.target.checked)}
                        />
                        <span>Contains explicit lyrics</span>
                      </label>
                    </Field>

                    <Field
                      label="Songwriters"
                      htmlFor={`${track.key}-songwriters`}
                      hint="Comma separated legal names, e.g. Nova Pierce, Idris Calloway"
                    >
                      <Textarea
                        id={`${track.key}-songwriters`}
                        rows={2}
                        value={track.songwriters}
                        placeholder="Nova Pierce, Idris Calloway"
                        onChange={(e) => setTrackField(track.key, 'songwriters', e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <div className="form-actions cluster">
        <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={submitting}>
          {submitLabel}
        </Button>
        <p className="form-actions__note">
          Releases are saved as drafts — you choose when to deliver them to stores.
        </p>
      </div>
    </form>
  );
}
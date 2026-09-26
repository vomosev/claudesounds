'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/AuthProvider';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Field, { Input, Select } from '../../components/ui/Field';
import Button from '../../components/ui/Button';

const INITIAL = {
  displayName: '',
  artistName: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'artist',
};

function passwordStrength(password) {
  if (!password) return { score: 0, label: 'Enter a password' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 2) return { score, label: 'Weak — add length, numbers or symbols' };
  if (score === 3) return { score, label: 'Fair — a symbol would make it stronger' };
  if (score === 4) return { score, label: 'Good password' };
  return { score, label: 'Strong password' };
}

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, status } = useAuth();

  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nextPath = searchParams?.get('next') || '/dashboard';

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(nextPath);
    }
  }, [status, nextPath, router]);

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function validate(v) {
    const next = {};
    if (!v.displayName.trim()) {
      next.displayName = 'Tell us your name so we know who to address.';
    } else if (v.displayName.trim().length > 120) {
      next.displayName = 'Keep this under 120 characters.';
    }

    if (!v.artistName.trim()) {
      next.artistName = 'Add the artist or label name that appears on your releases.';
    } else if (v.artistName.trim().length > 120) {
      next.artistName = 'Keep this under 120 characters.';
    }

    const email = v.email.trim();
    if (!email) {
      next.email = 'An email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      next.email = 'That email address does not look right.';
    }

    if (!v.password) {
      next.password = 'Choose a password.';
    } else if (v.password.length < 8) {
      next.password = 'Passwords must be at least 8 characters.';
    }

    if (!v.confirmPassword) {
      next.confirmPassword = 'Re-enter your password to confirm it.';
    } else if (v.confirmPassword !== v.password) {
      next.confirmPassword = 'The two passwords do not match.';
    }

    if (!['artist', 'label'].includes(v.role)) {
      next.role = 'Choose an account type.';
    }

    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setApiError('');

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await signup({
        displayName: values.displayName.trim(),
        artistName: values.artistName.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        role: values.role,
      });
      router.push(nextPath);
    } catch (err) {
      const message = err && err.message ? err.message : '';
      if (err && err.status === 409) {
        setErrors((prev) => ({ ...prev, email: 'That email is already registered.' }));
        setApiError('An account already exists with that email address. Try logging in instead.');
      } else if (err && err.status >= 400 && err.status < 500 && message) {
        setApiError(message);
      } else {
        setApiError("We couldn't reach ClaudeSounds — try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const strength = passwordStrength(values.password);

  return (
    <section className="auth-page stack">
      <Card className="auth-card" padded raised>
        <CardHeader
          title="Create your ClaudeSounds account"
          subtitle="Distribute to every major store, register your publishing splits and run release campaigns from one dashboard."
        />
        <CardBody>
          <form className="stack form-stack" onSubmit={handleSubmit} noValidate>
            {apiError ? (
              <div className="alert alert--danger" role="alert">
                <strong>We couldn&apos;t create your account.</strong>
                <span className="break-word">{apiError}</span>
              </div>
            ) : null}

            <Field
              label="Your name"
              htmlFor="displayName"
              required
              error={errors.displayName}
              hint="Used on statements and account emails."
            >
              <Input
                id="displayName"
                name="displayName"
                autoComplete="name"
                value={values.displayName}
                error={errors.displayName}
                onChange={(e) => setField('displayName', e.target.value)}
                placeholder="Mara Delgado"
              />
            </Field>

            <Field
              label="Artist or label name"
              htmlFor="artistName"
              required
              error={errors.artistName}
              hint="This is the name stores will display on your releases."
            >
              <Input
                id="artistName"
                name="artistName"
                autoComplete="organization"
                value={values.artistName}
                error={errors.artistName}
                onChange={(e) => setField('artistName', e.target.value)}
                placeholder="Nightwater Collective"
              />
            </Field>

            <Field label="Account type" htmlFor="role" required error={errors.role}>
              <Select
                id="role"
                name="role"
                value={values.role}
                error={errors.role}
                onChange={(e) => setField('role', e.target.value)}
              >
                <option value="artist">Independent artist</option>
                <option value="label">Label or management</option>
              </Select>
            </Field>

            <Field label="Email address" htmlFor="email" required error={errors.email}>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={values.email}
                error={errors.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="you@studio.com"
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              required
              error={errors.password}
              hint={`At least 8 characters. ${strength.label}`}
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                error={errors.password}
                onChange={(e) => setField('password', e.target.value)}
              />
            </Field>

            <Field
              label="Confirm password"
              htmlFor="confirmPassword"
              required
              error={errors.confirmPassword}
            >
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={values.confirmPassword}
                error={errors.confirmPassword}
                onChange={(e) => setField('confirmPassword', e.target.value)}
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" loading={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </Button>

            <p className="auth-meta">
              Already distributing with us? <Link href="/login">Log in to your dashboard</Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </section>
  );
}
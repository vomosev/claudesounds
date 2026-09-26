'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/AuthProvider';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Field, { Input } from '../../components/ui/Field';
import Button from '../../components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status, login } = useAuth();

  const nextParam = searchParams?.get('next') || '';
  const destination = nextParam && nextParam.startsWith('/') ? nextParam : '/dashboard';

  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && user) {
      router.replace(destination);
    }
  }, [status, user, router, destination]);

  function updateField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  function validate() {
    const errors = {};
    const email = values.email.trim();
    if (!email) {
      errors.email = 'Enter the email address on your account.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'That does not look like a valid email address.';
    }
    if (!values.password) {
      errors.password = 'Enter your password.';
    }
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setFormError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ email: values.email.trim(), password: values.password });
      router.replace(destination);
    } catch (err) {
      const statusCode = err && typeof err.status === 'number' ? err.status : 0;
      if (statusCode === 401 || statusCode === 400) {
        setFormError('That email and password combination did not match an account.');
      } else if (statusCode === 429) {
        setFormError('Too many sign-in attempts. Please wait a minute and try again.');
      } else if (statusCode >= 500) {
        setFormError('ClaudeSounds is having trouble right now. Please try again shortly.');
      } else {
        setFormError("We couldn't reach ClaudeSounds — try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page stack">
      <Card className="auth-card" padded raised>
        <CardHeader
          title="Log in to ClaudeSounds"
          subtitle="Pick up where you left off — deliveries, splits and campaign performance."
        />
        <CardBody>
          <form className="stack" onSubmit={handleSubmit} noValidate>
            {formError ? (
              <div className="error-panel" role="alert">
                <p>{formError}</p>
              </div>
            ) : null}

            <Field
              label="Email address"
              htmlFor="login-email"
              required
              error={fieldErrors.email}
            >
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@yourlabel.com"
                value={values.email}
                error={fieldErrors.email}
                onChange={(e) => updateField('email', e.target.value)}
                disabled={submitting}
                required
              />
            </Field>

            <Field
              label="Password"
              htmlFor="login-password"
              required
              error={fieldErrors.password}
              hint="Your session stays signed in on this device for 7 days."
            >
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={values.password}
                error={fieldErrors.password}
                onChange={(e) => updateField('password', e.target.value)}
                disabled={submitting}
                required
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" loading={submitting}>
              {submitting ? 'Signing you in…' : 'Log in'}
            </Button>
          </form>
        </CardBody>
      </Card>

      <p className="auth-alt">
        New to ClaudeSounds? <Link href="/signup">Create a free artist account</Link> and get your
        first release to stores this week.
      </p>
    </div>
  );
}
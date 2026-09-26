'use client';

import { useState } from 'react';
import Field, { Input, Select } from '../ui/Field';
import Button from '../ui/Button';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AuthForm({ mode = 'login', onSubmit, submitting = false, error = null }) {
  const isSignup = mode === 'signup';

  const [values, setValues] = useState({
    email: '',
    password: '',
    display_name: '',
    artist_name: '',
    role: 'artist',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});

  function setValue(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function validate(current) {
    const errors = {};

    const email = current.email.trim();
    if (!email) {
      errors.email = 'Enter the email address on your account.';
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = 'That does not look like a valid email address.';
    }

    if (!current.password) {
      errors.password = 'Enter your password.';
    } else if (current.password.length < 8) {
      errors.password = 'Passwords must be at least 8 characters.';
    }

    if (isSignup) {
      if (!current.display_name.trim()) {
        errors.display_name = 'Tell us what to call you.';
      } else if (current.display_name.trim().length < 2) {
        errors.display_name = 'Use at least 2 characters.';
      }

      if (!current.artist_name.trim()) {
        errors.artist_name = 'Add the artist or label name that appears on your releases.';
      }

      if (!['artist', 'label'].includes(current.role)) {
        errors.role = 'Choose whether you are an artist or a label.';
      }
    }

    return errors;
  }

  function handleBlur(event) {
    const { name } = event.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const errors = validate(values);
    if (errors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: errors[name] }));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const errors = validate(values);
    setFieldErrors(errors);
    setTouched({
      email: true,
      password: true,
      display_name: true,
      artist_name: true,
      role: true,
    });

    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload = isSignup
      ? {
          email: values.email.trim().toLowerCase(),
          password: values.password,
          display_name: values.display_name.trim(),
          artist_name: values.artist_name.trim(),
          role: values.role,
        }
      : {
          email: values.email.trim().toLowerCase(),
          password: values.password,
        };

    if (typeof onSubmit === 'function') {
      try {
        await onSubmit(payload);
      } catch (submitError) {
        // The parent page owns the error banner; nothing to do here.
      }
    }
  }

  const errorMessage =
    error && typeof error === 'object' ? error.message || 'Something went wrong. Please try again.' : error;

  return (
    <form className="auth-form stack" onSubmit={handleSubmit} noValidate>
      {errorMessage ? (
        <p className="form-banner form-banner--error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Field
        id="auth-email"
        label="Email address"
        error={touched.email ? fieldErrors.email : undefined}
        hint={isSignup ? 'We send delivery and payout notifications here.' : undefined}
      >
        <Input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@yourlabel.com"
          value={values.email}
          onChange={(event) => setValue('email', event.target.value)}
          onBlur={handleBlur}
          disabled={submitting}
        />
      </Field>

      <Field
        id="auth-password"
        label="Password"
        error={touched.password ? fieldErrors.password : undefined}
        hint={isSignup ? 'At least 8 characters.' : undefined}
      >
        <Input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          placeholder={isSignup ? 'Create a password' : 'Enter your password'}
          value={values.password}
          onChange={(event) => setValue('password', event.target.value)}
          onBlur={handleBlur}
          disabled={submitting}
        />
      </Field>

      {isSignup ? (
        <>
          <Field
            id="auth-display-name"
            label="Your name"
            error={touched.display_name ? fieldErrors.display_name : undefined}
          >
            <Input
              id="auth-display-name"
              name="display_name"
              type="text"
              autoComplete="name"
              placeholder="Mara Delgado"
              value={values.display_name}
              onChange={(event) => setValue('display_name', event.target.value)}
              onBlur={handleBlur}
              disabled={submitting}
            />
          </Field>

          <Field
            id="auth-artist-name"
            label="Artist or label name"
            error={touched.artist_name ? fieldErrors.artist_name : undefined}
            hint="This is the name stores will display on your releases."
          >
            <Input
              id="auth-artist-name"
              name="artist_name"
              type="text"
              placeholder="Night Terrace Records"
              value={values.artist_name}
              onChange={(event) => setValue('artist_name', event.target.value)}
              onBlur={handleBlur}
              disabled={submitting}
            />
          </Field>

          <Field
            id="auth-role"
            label="Account type"
            error={touched.role ? fieldErrors.role : undefined}
          >
            <Select
              id="auth-role"
              name="role"
              value={values.role}
              onChange={(event) => setValue('role', event.target.value)}
              onBlur={handleBlur}
              disabled={submitting}
            >
              <option value="artist">Independent artist</option>
              <option value="label">Label or distributor</option>
            </Select>
          </Field>
        </>
      ) : null}

      <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={submitting}>
        {isSignup ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}
'use client';

import Link from 'next/link';
import { forwardRef } from 'react';
import Spinner from './Spinner';

const VARIANTS = {
  primary: 'btn--primary',
  secondary: 'btn--secondary',
  ghost: 'btn--ghost',
  danger: 'btn--danger',
};

const SIZES = {
  sm: 'btn--sm',
  md: 'btn--md',
  lg: 'btn--lg',
};

function buildClassName({ variant, size, loading, disabled, className }) {
  return [
    'btn',
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    loading ? 'btn--loading' : '',
    disabled ? 'btn--disabled' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');
}

const Button = forwardRef(function Button(
  {
    as,
    href,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    onClick,
    children,
    className,
    ...rest
  },
  ref
) {
  const isDisabled = Boolean(disabled || loading);
  const classes = buildClassName({ variant, size, loading, disabled: isDisabled, className });

  const content = (
    <>
      {loading ? (
        <span className="btn__spinner" aria-hidden="true">
          <Spinner size="sm" label="Loading" />
        </span>
      ) : null}
      <span className="btn__label">{children}</span>
    </>
  );

  const renderAsLink = as === 'a' || as === 'link' || (as === undefined && typeof href === 'string' && href.length > 0);

  if (renderAsLink && typeof href === 'string' && href.length > 0) {
    if (isDisabled) {
      return (
        <span
          ref={ref}
          className={classes}
          role="link"
          aria-disabled="true"
          aria-busy={loading ? 'true' : undefined}
          {...rest}
        >
          {content}
        </span>
      );
    }

    const isExternal = /^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:');

    if (isExternal) {
      return (
        <a
          ref={ref}
          href={href}
          className={classes}
          onClick={onClick}
          rel="noopener noreferrer"
          {...rest}
        >
          {content}
        </a>
      );
    }

    return (
      <Link ref={ref} href={href} className={classes} onClick={onClick} {...rest}>
        {content}
      </Link>
    );
  }

  const Component = as && as !== 'a' && as !== 'link' ? as : 'button';

  if (Component === 'button') {
    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        onClick={onClick}
        disabled={isDisabled}
        aria-busy={loading ? 'true' : undefined}
        {...rest}
      >
        {content}
      </button>
    );
  }

  return (
    <Component
      ref={ref}
      className={classes}
      onClick={isDisabled ? undefined : onClick}
      aria-disabled={isDisabled ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    >
      {content}
    </Component>
  );
});

export default Button;
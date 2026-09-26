'use client';

import { forwardRef, useId } from 'react';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className,
  children,
}) {
  const generatedId = useId();
  const hintId = hint ? `${htmlFor || generatedId}-hint` : undefined;
  const errorId = error ? `${htmlFor || generatedId}-error` : undefined;

  return (
    <div className={cx('field', error && 'field--invalid', className)}>
      {label ? (
        <label className="field__label" htmlFor={htmlFor}>
          <span>{label}</span>
          {required ? (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {children}

      {hint && !error ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { className, error, describedBy, type = 'text', ...props },
  ref
) {
  return (
    <input
      {...props}
      ref={ref}
      type={type}
      className={cx('input', error && 'input--invalid', className)}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedBy || undefined}
    />
  );
});

export const Textarea = forwardRef(function Textarea(
  { className, error, describedBy, rows = 4, ...props },
  ref
) {
  return (
    <textarea
      {...props}
      ref={ref}
      rows={rows}
      className={cx('textarea', error && 'input--invalid', className)}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedBy || undefined}
    />
  );
});

export const Select = forwardRef(function Select(
  { className, error, describedBy, options, placeholder, children, ...props },
  ref
) {
  return (
    <select
      {...props}
      ref={ref}
      className={cx('select', error && 'input--invalid', className)}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedBy || undefined}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {Array.isArray(options)
        ? options.map((opt) => {
            const value = typeof opt === 'string' ? opt : opt.value;
            const label = typeof opt === 'string' ? opt : opt.label;
            return (
              <option key={String(value)} value={value}>
                {label}
              </option>
            );
          })
        : children}
    </select>
  );
});

export const Checkbox = forwardRef(function Checkbox(
  { className, label, describedBy, ...props },
  ref
) {
  return (
    <label className={cx('checkbox', className)}>
      <input
        {...props}
        ref={ref}
        type="checkbox"
        className="checkbox__control"
        aria-describedby={describedBy || undefined}
      />
      {label ? <span className="checkbox__label">{label}</span> : null}
    </label>
  );
});
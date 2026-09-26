'use client';

export default function Spinner({ size = 'md', label = 'Loading…', className = '' }) {
  const sizeClass = `spinner--${['sm', 'md', 'lg'].includes(size) ? size : 'md'}`;
  const classes = ['spinner', sizeClass, className].filter(Boolean).join(' ');

  return (
    <span className={classes} role="status" aria-live="polite">
      <svg
        className="spinner__svg"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <circle className="spinner__track" cx="12" cy="12" r="9" strokeWidth="3" />
        <path
          className="spinner__head"
          d="M21 12a9 9 0 0 0-9-9"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
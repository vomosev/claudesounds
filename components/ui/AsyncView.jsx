'use client';

import Button from './Button';
import Spinner from './Spinner';
import EmptyState from './EmptyState';

function DefaultSkeleton() {
  return (
    <div className="async-skeleton" aria-hidden="true">
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--block" />
    </div>
  );
}

function resolveMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error.status === 401) {
    return 'Your session has expired. Please sign in again to continue.';
  }
  if (error.status === 404) {
    return 'We could not find what you were looking for.';
  }
  if (error.message) return error.message;
  return "We couldn't reach ClaudeSounds — try again in a moment.";
}

export default function AsyncView({
  loading = false,
  error = null,
  isEmpty = false,
  onRetry,
  skeleton,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'Once you add data it will appear in this panel.',
  emptyAction = null,
  children,
}) {
  if (loading) {
    return (
      <div className="async-view async-view--loading" role="status" aria-live="polite" aria-busy="true">
        {skeleton || <DefaultSkeleton />}
        <span className="visually-hidden">
          <Spinner size="sm" label="Loading content" />
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="async-view async-view--error card card--padded" role="alert">
        <div className="error-panel">
          <svg
            className="error-panel__icon"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3 2.5 20h19L12 3Z" />
            <path d="M12 9.5v4.5" />
            <path d="M12 17.2h.01" />
          </svg>
          <div className="error-panel__body">
            <h3 className="error-panel__title">Something went wrong</h3>
            <p className="error-panel__message break-word">{resolveMessage(error)}</p>
          </div>
        </div>
        {typeof onRetry === 'function' ? (
          <div className="cluster">
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="async-view async-view--empty">
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return <div className="async-view">{children}</div>;
}
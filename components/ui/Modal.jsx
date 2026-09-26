'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function Modal({
  open = false,
  title,
  onClose,
  footer = null,
  children,
  labelledById,
}) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const generatedId = useId();
  const headingId = labelledById || `modal-title-${generatedId}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') onClose();
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [open]);

  // Focus management: move focus in, restore on close
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = window.requestAnimationFrame(() => {
      const node = dialogRef.current;
      if (!node) return;
      const focusable = node.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        node.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      const previous = previouslyFocusedRef.current;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [open]);

  // Escape to close + focus trap
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusable.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !node.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, handleClose]);

  if (!mounted || !open || typeof document === 'undefined') return null;

  function onBackdropMouseDown(event) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  return createPortal(
    <div className="modal__backdrop" onMouseDown={onBackdropMouseDown}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? headingId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="modal__header">
          {title ? (
            <h2 className="modal__title" id={headingId}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="modal__close"
            onClick={handleClose}
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>

        <div className="modal__body">{children}</div>

        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type ActionModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional sticky footer (e.g. primary actions) for thumb reach on phones. */
  footer?: ReactNode;
  /** Higher stacking for confirmations over other modals */
  elevated?: boolean;
};

const SCROLL_KEY = 'panoptes.action-modal.scrollY';

/** Bottom sheet on mobile / centered dialog on larger screens. */
export function ActionModal({ open, title, subtitle, onClose, children, footer, elevated = false }: ActionModalProps) {
  useEffect(() => {
    if (!open) return;
    try {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    } catch {
      /* ignore */
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    try {
      const raw = sessionStorage.getItem(SCROLL_KEY);
      if (raw == null) return;
      const y = Number(raw);
      if (!Number.isNaN(y)) {
        requestAnimationFrame(() => window.scrollTo({ top: y }));
      }
    } catch {
      /* ignore */
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-end justify-center sm:items-center sm:p-6 ${elevated ? 'z-[90]' : 'z-[80]'}`}
      role="dialog"
      aria-modal="true"
    >
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-on-surface/55"
        onClick={onClose}
        type="button"
      />
      <div className={`relative flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col rounded-t-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-[var(--shadow-card)] sm:max-h-[85vh] sm:rounded-2xl ${elevated ? 'z-[91]' : 'z-[81]'}`}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-outline-variant/70 sm:hidden" aria-hidden />
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-outline-variant/30 px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-primary">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-on-surface-variant">{subtitle}</p>}
          </div>
          <button
            aria-label="Cerrar"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain p-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-outline-variant/30 bg-surface-container-lowest px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  hasCompletedTour,
  markTourCompleted,
  TOURS,
  type TourStep,
} from '@/js/config/tours';

type Rect = { top: number; left: number; width: number; height: number };

function measure(selector: string): Rect | null {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function scrollToTarget(selector: string) {
  const el = document.querySelector(selector) as HTMLElement | null;
  el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

type GuidedTourProps = {
  tourId: string;
  open: boolean;
  onClose: () => void;
};

const PAD = 8;

/** Spotlight tour: dims the UI and highlights one target at a time. */
export function GuidedTour({ tourId, open, onClose }: GuidedTourProps) {
  const tour = TOURS[tourId];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const steps = tour?.steps ?? [];
  const step: TourStep | undefined = steps[index];
  const isLast = index >= steps.length - 1;

  const refresh = useCallback(() => {
    if (!step) {
      setRect(null);
      return;
    }
    setRect(measure(step.target));
  }, [step]);

  const close = useCallback(() => {
    markTourCompleted(tourId);
    onClose();
  }, [tourId, onClose]);

  const next = useCallback(() => {
    if (isLast) {
      markTourCompleted(tourId);
      onClose();
      return;
    }
    setIndex((i) => i + 1);
  }, [isLast, tourId, onClose]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open, tourId]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    scrollToTarget(step.target);
    const t = window.setTimeout(refresh, 280);
    refresh();
    return () => window.clearTimeout(t);
  }, [open, step, refresh]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => refresh();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, next, prev]);

  if (!open || !tour || !step) return null;

  const highlightStyle = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  const tooltipStyle = (() => {
    const tipWidth = Math.min(352, window.innerWidth - 32);
    if (!rect) {
      return {
        top: Math.max(16, window.innerHeight * 0.35),
        left: 16,
        width: tipWidth,
        transform: 'none' as const,
      };
    }
    const below = rect.top + rect.height + PAD + 12;
    const spaceBelow = window.innerHeight - below;
    const top = spaceBelow > 200 ? below : Math.max(16, Math.min(rect.top - PAD - 140, window.innerHeight - 220));
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - tipWidth - 16);
    return { top, left, width: tipWidth, transform: 'none' as const };
  })();

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={tour.title}>
      {/* Click catcher; dimming comes from spotlight box-shadow */}
      <div className="absolute inset-0" onClick={close} />

      {highlightStyle ? (
        <div
          className="pointer-events-none absolute z-[101] rounded-xl ring-2 ring-primary shadow-[0_0_0_9999px_rgba(26,28,28,0.72)] transition-all duration-200"
          style={highlightStyle}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 z-[101] bg-on-surface/70" />
      )}

      <div
        className="absolute z-[102] rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-[var(--shadow-card)]"
        style={tooltipStyle}
      >
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          {tour.title} · {index + 1}/{steps.length}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-primary">
          {step.title}
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">{step.body}</p>
        {!rect && (
          <p className="mt-2 text-xs text-amber-800">
            Este elemento no está visible ahora. Continúa o salta el recorrido.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            className="min-h-11 px-2 text-sm font-semibold text-on-surface-variant"
            onClick={close}
            type="button"
          >
            Saltar
          </button>
          <div className="flex gap-2">
            <button
              className="panoptes-btn-secondary text-sm"
              disabled={index === 0}
              onClick={prev}
              type="button"
            >
              Anterior
            </button>
            <button className="panoptes-btn-primary text-sm" onClick={next} type="button">
              {isLast ? 'Terminar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type TourHelpButtonProps = {
  onStart: () => void;
  className?: string;
};

/** Atom: ? button to reopen a guided tour. */
export function TourHelpButton({ onStart, className = '' }: TourHelpButtonProps) {
  return (
    <button
      aria-label="Ver tutorial guiado"
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant/60 bg-surface-container-lowest text-primary shadow-sm transition hover:bg-secondary-container/40 ${className}`}
      onClick={onStart}
      title="Tutorial"
      type="button"
    >
      <span className="material-symbols-outlined text-[22px]">help</span>
    </button>
  );
}

/** Hook: auto-open tour the first time; expose start() for the ? button. */
export function useGuidedTour(tourId: string | undefined) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tourId || !TOURS[tourId]) return;
    if (!hasCompletedTour(tourId)) {
      const t = window.setTimeout(() => setOpen(true), 450);
      return () => window.clearTimeout(t);
    }
  }, [tourId]);

  return {
    open,
    start: () => setOpen(true),
    close: () => setOpen(false),
  };
}

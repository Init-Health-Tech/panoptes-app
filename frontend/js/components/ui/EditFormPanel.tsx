import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';

import { Button } from '@/js/components/ui/Button';

type EditFormPanelProps = {
  title: string;
  submitLabel?: string;
  trigger?: ReactNode;
  children: ReactNode;
  onSubmit: () => Promise<void>;
  onSuccess?: () => void;
  /** Wider layout with grid-friendly fields for denser forms */
  expanded?: boolean;
};

export function EditFormPanel({
  title,
  submitLabel = 'Guardar cambios',
  trigger,
  children,
  onSubmit,
  onSuccess,
  expanded = false,
}: EditFormPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit();
      setOpen(false);
      onSuccess?.();
    } catch {
      setError('No se pudo guardar. Verifique los datos e intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={expanded && open ? 'w-full' : undefined}>
      {!open && (
        <button
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
          onClick={() => setOpen(true)}
          type="button"
        >
          {trigger ?? (
            <>
              <span className="material-symbols-outlined text-base">edit</span>
              <span>Editar</span>
            </>
          )}
        </button>
      )}

      {open && (
        <form
          className={
            expanded
              ? 'mt-3 w-full space-y-4 rounded-lg border border-outline-variant/50 bg-surface-container-low p-4'
              : 'panoptes-card mt-3 space-y-3 border border-outline-variant/40 p-3'
          }
          onSubmit={handleSubmit}
        >
          <div className="flex items-center justify-between gap-2">
            <h3
              className={
                expanded
                  ? 'font-[family-name:var(--font-display)] text-sm font-semibold text-on-surface'
                  : 'text-xs font-semibold uppercase tracking-wide text-on-surface-variant'
              }
            >
              {title}
            </h3>
            <button
              className="text-on-surface-variant hover:text-on-surface"
              onClick={() => setOpen(false)}
              type="button"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
          <div className={expanded ? 'grid gap-4 sm:grid-cols-2' : 'space-y-3'}>{children}</div>
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="flex gap-2">
            <Button className="text-sm" disabled={loading} type="submit">
              {loading ? 'Guardando…' : submitLabel}
            </Button>
            <Button className="text-sm" onClick={() => setOpen(false)} type="button" variant="secondary">
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

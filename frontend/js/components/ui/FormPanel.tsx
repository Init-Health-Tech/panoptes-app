import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';

import { Button } from '@/js/components/ui/Button';

type FormPanelProps = {
  title: string;
  submitLabel: string;
  children: ReactNode;
  onSubmit: () => Promise<void>;
  onSuccess?: () => void;
};

export function FormPanel({ title, submitLabel, children, onSubmit, onSuccess }: FormPanelProps) {
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

  if (!open) {
    return (
      <Button className="mb-4" icon="add" onClick={() => setOpen(true)} type="button">
        {title}
      </Button>
    );
  }

  return (
    <form className="panoptes-card mb-6 space-y-4 p-4" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold text-on-surface">
          {title}
        </h2>
        <button
          className="text-on-surface-variant hover:text-on-surface"
          onClick={() => setOpen(false)}
          type="button"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      {children}
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex gap-2">
        <Button disabled={loading} type="submit">
          {loading ? 'Guardando…' : submitLabel}
        </Button>
        <Button onClick={() => setOpen(false)} type="button" variant="secondary">
          Cancelar
        </Button>
      </div>
    </form>
  );
}

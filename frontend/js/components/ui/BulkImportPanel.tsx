import { useRef, useState } from 'react';

import type { BulkImportResult } from '@/js/api/bulkImport';
import { Button } from '@/js/components/ui/Button';

type BulkImportPanelProps = {
  title?: string;
  description: string;
  onDownloadTemplate: () => Promise<void>;
  onUpload: (file: File) => Promise<BulkImportResult>;
  onSuccess?: () => void;
};

export function BulkImportPanel({
  title = 'Carga masiva (Excel)',
  description,
  onDownloadTemplate,
  onUpload,
  onSuccess,
}: BulkImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [fileName, setFileName] = useState('');

  const handleDownload = async () => {
    setError('');
    try {
      await onDownloadTemplate();
    } catch {
      setError('No se pudo descargar la plantilla.');
    }
  };

  const handleUpload = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('Selecciona un archivo .xlsx');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = await onUpload(file);
      setResult(data);
      if (data.created > 0) onSuccess?.();
    } catch {
      setError('No se pudo importar el archivo. Verifica el formato o tus permisos.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button className="mb-4" icon="upload_file" onClick={() => setOpen(true)} type="button" variant="secondary">
        {title}
      </Button>
    );
  }

  return (
    <section className="panoptes-card mb-6 space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold text-on-surface">
            {title}
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
        </div>
        <button
          className="text-on-surface-variant hover:text-on-surface"
          onClick={() => {
            setOpen(false);
            setResult(null);
            setError('');
            setFileName('');
          }}
          type="button"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button icon="download" onClick={handleDownload} type="button" variant="secondary">
          Descargar plantilla
        </Button>
        <label className="panoptes-btn-secondary inline-flex cursor-pointer items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">attach_file</span>
          {fileName || 'Elegir archivo .xlsx'}
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
            ref={inputRef}
            type="file"
          />
        </label>
        <Button disabled={busy || !fileName} icon="cloud_upload" onClick={handleUpload} type="button">
          {busy ? 'Importando…' : 'Importar'}
        </Button>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {result && (
        <div className="space-y-3 rounded-lg border border-outline-variant/40 bg-surface-container/40 p-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-secondary-container/60 px-2.5 py-0.5 font-semibold text-primary">
              {result.created} creados
            </span>
            <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 font-semibold text-on-surface-variant">
              {result.skipped} omitidos
            </span>
            <span className="rounded-full bg-error-container/40 px-2.5 py-0.5 font-semibold text-error">
              {result.errors.length} avisos
            </span>
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-48 overflow-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-on-surface-variant">Fila</th>
                    <th className="px-2 py-1 text-left text-on-surface-variant">Campo</th>
                    <th className="px-2 py-1 text-left text-on-surface-variant">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.slice(0, 100).map((err, idx) => (
                    <tr key={`${err.row}-${err.field}-${idx}`} className="border-t border-outline-variant/20">
                      <td className="px-2 py-1 font-mono">{err.row || '—'}</td>
                      <td className="px-2 py-1">{err.field}</td>
                      <td className="px-2 py-1 text-on-surface-variant">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.errors.length > 100 && (
                <p className="mt-2 text-xs text-on-surface-variant">
                  Mostrando 100 de {result.errors.length} avisos.
                </p>
              )}
            </div>
          )}
          {result.created > 0 && result.errors.length === 0 && (
            <p className="text-sm text-primary">Importación completada sin errores.</p>
          )}
        </div>
      )}
    </section>
  );
}

import { isRouteErrorResponse, useRouteError } from 'react-router';

import { getApiBaseUrl } from '@/js/config';

/** Shown when root loader or route fails (missing API, CORS, etc.). */
export function RootErrorPage() {
  const error = useRouteError();
  const apiBase = getApiBaseUrl();

  let title = 'Error de aplicación';
  let detail = 'Ocurrió un error inesperado.';

  if (isRouteErrorResponse(error)) {
    title = error.statusText || title;
    detail = typeof error.data === 'string' ? error.data : detail;
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <div className="panoptes-card max-w-lg p-6 shadow-[var(--shadow-card)]">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-on-surface">
          {title}
        </h1>
        <p className="mt-3 whitespace-pre-wrap text-sm text-on-surface-variant">{detail}</p>
        <div className="mt-4 rounded-lg bg-surface-container px-3 py-2 font-mono text-xs text-on-surface-variant">
          <div>Frontend: {typeof window !== 'undefined' ? window.location.origin : '—'}</div>
          <div>API_BASE_URL: {apiBase || '(vacío — el FE llama /api en este mismo host)'}</div>
        </div>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-on-surface-variant">
          <li>
            En Vercel → Settings → Environment Variables define{' '}
            <code className="font-mono">API_BASE_URL=https://api.avant.init.com.mx</code> y{' '}
            <strong>Redeploy</strong>.
          </li>
          <li>
            En el backend (VM) incluye este origen en{' '}
            <code className="font-mono">CORS_ALLOWED_ORIGINS</code> y{' '}
            <code className="font-mono">CSRF_TRUSTED_ORIGINS</code> (también el preview{' '}
            <code className="font-mono">*.vercel.app</code> si lo usas).
          </li>
          <li>Confirma que la API responde en HTTPS.</li>
        </ol>
      </div>
    </div>
  );
}

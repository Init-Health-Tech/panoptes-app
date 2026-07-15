import { AxiosError } from 'axios';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { login } from '@/js/api/auth';
import { Button } from '@/js/components/ui/Button';
import { Input } from '@/js/components/ui/Input';
import { PanoptesLogo } from '@/js/components/ui/PanoptesLogo';
import { safeNextPath } from '@/js/utils/auth';

/** Turn any login failure into a clear, actionable message (never leave the UI silent). */
function loginErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    // The API answered: use its message (e.g. "Credenciales incorrectas." on 400).
    if (err.response) {
      const detail = (err.response.data as { detail?: unknown } | undefined)?.detail;
      if (typeof detail === 'string' && detail.trim()) {
        return detail;
      }
      if (err.response.status >= 500) {
        return 'El servidor tuvo un error. Intenta de nuevo en un momento.';
      }
      return 'No se pudo iniciar sesión. Revisa tus datos e intenta de nuevo.';
    }
    // No response: timeout or the API is unreachable.
    if (err.code === 'ECONNABORTED') {
      return 'El servidor tardó demasiado en responder. Verifica tu conexión e intenta de nuevo.';
    }
    return 'No se pudo contactar el servidor. Verifica tu conexión e intenta de nuevo.';
  }
  return 'No se pudo iniciar sesión. Intenta de nuevo.';
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const next = safeNextPath(searchParams.get('next'));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0f2a17] via-[#0b1f12] to-[#05100a] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <PanoptesLogo size={56} />
          <div>
            <h1 className="text-2xl font-bold text-white">Panoptes RFID</h1>
            <p className="text-sm text-white/70">Clinical &amp; Logistics Intelligence</p>
          </div>
        </div>

        <div className="panoptes-card p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-on-surface">Bienvenido</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Accede a tu terminal de gestión RFID
          </p>

          {error && (
            <p
              className="mt-4 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
              role="alert"
            >
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </p>
          )}

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface" htmlFor="email">
                Correo electrónico
              </label>
              <Input
                autoComplete="username"
                autoFocus
                id="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="demo@init.health"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface" htmlFor="password">
                Contraseña
              </label>
              <Input
                autoComplete="current-password"
                id="password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                type="password"
                value={password}
              />
            </div>

            <Button
              className="mt-2 w-full justify-center"
              disabled={submitting}
              icon={submitting ? undefined : 'arrow_forward'}
              type="submit"
            >
              {submitting ? 'Iniciando…' : 'Iniciar sesión'}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-outline-variant/30 pt-4 text-xs text-on-surface-variant">
            <span>
              Powered by <strong className="text-on-surface">INIT Health Tech</strong>
            </span>
            <span className="flex gap-1">
              <span className="material-symbols-outlined text-base">verified_user</span>
              <span className="material-symbols-outlined text-base">encrypted</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

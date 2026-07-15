import { useState } from 'react';
import { useNavigate } from 'react-router';

import { logout } from '@/js/api/auth';

type LogoutButtonProps = {
  compact?: boolean;
};

export function LogoutButton({ compact = false }: LogoutButtonProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } catch {
      // Ignore: we redirect to login regardless.
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <button
      className={
        compact
          ? 'inline-flex w-full min-h-11 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface'
          : 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface'
      }
      disabled={busy}
      onClick={handleLogout}
      title={compact ? 'Cerrar sesión' : undefined}
      type="button"
    >
      <span className="material-symbols-outlined text-[20px]">logout</span>
      {!compact && 'Cerrar sesión'}
    </button>
  );
}

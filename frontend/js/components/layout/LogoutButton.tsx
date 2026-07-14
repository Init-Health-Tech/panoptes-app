import { parse as cookieParse } from 'cookie';

import { getApiBaseUrl } from '@/js/config';
import { logoutActionUrl } from '@/js/utils/auth';

type LogoutButtonProps = {
  compact?: boolean;
};

export function LogoutButton({ compact = false }: LogoutButtonProps) {
  const { csrftoken } = cookieParse(document.cookie);
  const next = getApiBaseUrl() ? window.location.origin : '/';

  return (
    <form action={logoutActionUrl()} method="post">
      <input name="csrfmiddlewaretoken" type="hidden" value={csrftoken ?? ''} />
      <input name="next" type="hidden" value={next} />
      <button
        className={
          compact
            ? 'inline-flex w-full min-h-11 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface'
            : 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface'
        }
        title={compact ? 'Cerrar sesión' : undefined}
        type="submit"
      >
        <span className="material-symbols-outlined text-[20px]">logout</span>
        {!compact && 'Cerrar sesión'}
      </button>
    </form>
  );
}

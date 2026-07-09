import { parse as cookieParse } from 'cookie';

export function LogoutButton() {
  const { csrftoken } = cookieParse(document.cookie);

  return (
    <form action="/logout/" method="post">
      <input name="csrfmiddlewaretoken" type="hidden" value={csrftoken ?? ''} />
      <button
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
        type="submit"
      >
        <span className="material-symbols-outlined text-[20px]">logout</span>
        Cerrar sesión
      </button>
    </form>
  );
}

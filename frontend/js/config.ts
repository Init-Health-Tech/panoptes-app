/** Runtime/build-time config for split deploy (Vercel FE + API host). */

/** API origin without trailing slash. Empty = same-origin (local monolith). */
export function getApiBaseUrl(): string {
  const fromWindow =
    typeof window !== 'undefined' && typeof window.__API_BASE_URL__ === 'string'
      ? window.__API_BASE_URL__
      : '';
  const fromEnv =
    typeof process !== 'undefined' && typeof process.env?.API_BASE_URL === 'string'
      ? process.env.API_BASE_URL
      : '';
  return (fromWindow || fromEnv || '').replace(/\/$/, '');
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!path.startsWith('/')) {
    return base ? `${base}/${path}` : path;
  }
  return base ? `${base}${path}` : path;
}

/**
 * In-memory CSRF token.
 *
 * The SPA can run on a different origin than the API (e.g. Vercel), where it cannot
 * read the `csrftoken` cookie via `document.cookie`. So we keep the token that
 * `GET /api/auth/csrf/` returns in memory and send it as the `X-CSRFToken` header.
 */
let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token || null;
}

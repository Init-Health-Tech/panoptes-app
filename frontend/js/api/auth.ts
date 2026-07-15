import { client } from '@/js/api/client.gen';
import { apiUrl, getCsrfToken, setCsrfToken } from '@/js/config';

export interface CurrentUser {
  id: number;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_platform_admin: boolean;
}

// Build absolute URLs so these calls always hit the API host, not the SPA origin
// (Vercel). Relying on `client.instance.defaults.baseURL` proved fragile: a request
// to a relative `/api/...` path resolves against the frontend origin and 404/405s.
const CSRF_URL = () => apiUrl('/api/auth/csrf/');
const LOGIN_URL = () => apiUrl('/api/auth/login/');
const LOGOUT_URL = () => apiUrl('/api/auth/logout/');
const USER_URL = () => apiUrl('/api/auth/user/');

/** Fetch the CSRF token and keep it in memory (also sets the `csrftoken` cookie). */
export async function bootstrapCsrf(force = false): Promise<string | null> {
  if (!force && getCsrfToken()) {
    return getCsrfToken();
  }
  const { data } = await client.instance.get<{ csrfToken: string }>(CSRF_URL());
  setCsrfToken(data.csrfToken);
  return data.csrfToken;
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const { data } = await client.instance.post<CurrentUser>(LOGIN_URL(), {
    email,
    password,
  });
  // The session changed; refresh the CSRF token bound to it for later writes.
  await bootstrapCsrf(true);
  return data;
}

export async function logout(): Promise<void> {
  await client.instance.post(LOGOUT_URL());
  setCsrfToken(null);
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await client.instance.get<CurrentUser>(USER_URL());
  return data;
}

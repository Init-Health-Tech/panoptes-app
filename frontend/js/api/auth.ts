import { client } from '@/js/api/client.gen';
import { getCsrfToken, setCsrfToken } from '@/js/config';

export interface CurrentUser {
  id: number;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_platform_admin: boolean;
}

/** Fetch the CSRF token and keep it in memory (also sets the `csrftoken` cookie). */
export async function bootstrapCsrf(force = false): Promise<string | null> {
  if (!force && getCsrfToken()) {
    return getCsrfToken();
  }
  const { data } = await client.instance.get<{ csrfToken: string }>('/api/auth/csrf/');
  setCsrfToken(data.csrfToken);
  return data.csrfToken;
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const { data } = await client.instance.post<CurrentUser>('/api/auth/login/', {
    email,
    password,
  });
  // The session changed; refresh the CSRF token bound to it for later writes.
  await bootstrapCsrf(true);
  return data;
}

export async function logout(): Promise<void> {
  await client.instance.post('/api/auth/logout/');
  setCsrfToken(null);
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await client.instance.get<CurrentUser>('/api/auth/user/');
  return data;
}

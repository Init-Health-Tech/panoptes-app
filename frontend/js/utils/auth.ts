import { apiUrl, getApiBaseUrl } from '@/js/config';

/** Absolute path on the SPA, used as login `next` when FE and API are split. */
export function loginRedirectUrl(nextPath: string): string {
  const next = getApiBaseUrl()
    ? `${window.location.origin}${nextPath.startsWith('/') ? nextPath : `/${nextPath}`}`
    : nextPath;
  return apiUrl(`/login/?next=${encodeURIComponent(next)}`);
}

export function logoutActionUrl(): string {
  return apiUrl('/logout/');
}

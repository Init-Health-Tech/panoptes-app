import { redirect } from 'react-router';

/** Safe relative path to send back to after login (rejects absolute/external URLs). */
export function safeNextPath(nextPath: string | null | undefined): string {
  if (!nextPath) return '/';
  // Reject absolute URLs and protocol-relative URLs to avoid open redirects.
  if (/^https?:\/\//i.test(nextPath) || nextPath.startsWith('//')) return '/';
  return nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
}

/** Client-side redirect to the React login route, preserving where to return to. */
export function loginRedirect(nextPath: string) {
  const next = safeNextPath(nextPath);
  const qs = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
  return redirect(`/login${qs}`);
}

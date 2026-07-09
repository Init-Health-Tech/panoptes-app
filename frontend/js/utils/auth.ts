export function loginRedirectUrl(next: string): string {
  return `/login/?next=${encodeURIComponent(next)}`;
}

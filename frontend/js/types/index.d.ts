export {};

declare global {
  interface Window {
    SENTRY_DSN: string;
    COMMIT_SHA: string;
    __API_BASE_URL__?: string;
    Urls: unknown;
  }
}

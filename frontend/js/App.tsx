import * as Sentry from '@sentry/react';
import { parse as cookieParse } from 'cookie';
import { RouterProvider } from 'react-router/dom';

import { client } from '@/js/api/client.gen';
import { getApiBaseUrl, getCsrfToken } from '@/js/config';
import router from '@/js/routes';

const apiBaseUrl = getApiBaseUrl();
// `withCredentials` must be part of the client config so it is spread into every
// request (setting it only on instance.defaults is not enough for cross-origin cookies).
client.setConfig({
  ...(apiBaseUrl ? { baseURL: apiBaseUrl } : {}),
  withCredentials: true,
});
if (apiBaseUrl) {
  client.instance.defaults.baseURL = apiBaseUrl;
}
client.instance.defaults.withCredentials = true;

client.instance.interceptors.request.use((request) => {
  // Prefer the in-memory token (works cross-origin); fall back to the cookie for the
  // same-origin monolith where `document.cookie` is readable.
  const token = getCsrfToken() || cookieParse(document.cookie).csrftoken;
  if (request.headers && token) {
    request.headers['X-CSRFTOKEN'] = token;
  }
  return request;
});

const App = () => (
  <Sentry.ErrorBoundary fallback={<p>An error has occurred</p>}>
    <RouterProvider router={router} />
  </Sentry.ErrorBoundary>
);

export default App;

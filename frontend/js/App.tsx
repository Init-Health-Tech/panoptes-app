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
  // Django validates X-CSRFToken against the `csrftoken` cookie (double-submit), so
  // prefer the cookie value: on a same-site subdomain (e.g. avant.init.com.mx) the
  // cookie is `Domain=.init.com.mx` and readable via document.cookie, guaranteeing the
  // header matches. The in-memory token is only a fallback for a truly cross-site SPA
  // (e.g. *.vercel.app) where document.cookie can't read the API's cookie.
  const token = cookieParse(document.cookie).csrftoken || getCsrfToken();
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

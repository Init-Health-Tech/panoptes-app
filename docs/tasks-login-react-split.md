# Tasks — Login en React + front/back separado (Vercel + VM)

Objetivo: mover el login (y todo el flujo de auth) al frontend React, manteniendo
**auth de sesión** de Django y el build actual de **webpack**. El front vive en Vercel
(`avant.init.com.mx` y/o `panoptes-app.vercel.app`) y el backend en la VM
(`api.avant.init.com.mx`).

## Decisiones

- **Auth**: sesión de Django (cookie `sessionid` HttpOnly). Nada de JWT.
- **CSRF cross-origin**: el front pide el token a `GET /api/auth/csrf/` y lo guarda
  **en memoria** (no lee `document.cookie`, así funciona también desde `*.vercel.app`).
  El navegador manda la cookie `csrftoken` automáticamente (SameSite=None) y Django
  compara header vs cookie.
- **Build**: seguimos con webpack (`build:vercel`). Vite queda fuera de alcance.
- **Login de Django** (`/login/`) se conserva solo para `/admin/`. El SPA usa `/api/auth/*`.

## Backend

- [x] `common/api_views.py`: `CsrfView` (GET, AllowAny, `ensure_csrf_cookie`),
      `LoginView` (POST, AllowAny), `LogoutView` (POST), `CurrentUserView` (GET, IsAuthenticated).
- [x] `common/api_urls.py`: rutas `csrf/`, `login/`, `logout/`, `user/`.
- [x] `project_name/urls.py`: `path("api/auth/", include("common.api_urls"))`.

## Frontend

- [x] `config.ts`: store en memoria del CSRF (`getCsrfToken`/`setCsrfToken`).
- [x] `api/auth.ts`: `bootstrapCsrf()`, `login()`, `logout()`, `fetchCurrentUser()`.
- [x] `App.tsx`: interceptor usa token en memoria (fallback a cookie para local same-origin).
- [x] `pages/Login.tsx`: formulario React (branding Panoptes) + manejo de errores.
- [x] `routes/index.tsx`: ruta `/login` fuera del layout autenticado.
- [x] `utils/auth.ts`: `loginRedirect(next)` → `redirect('/login?next=...')` (client-side).
- [x] Loaders (`modules`, `dashboard`, `inventory`, `medical`, `logistics`, `instrumental`,
      `users`): redirigir a `/login` de React en 401/403.
- [x] `components/layout/LogoutButton.tsx`: `logout()` por JS y navegar a `/login`.
- [x] `modulesLoader`: `bootstrapCsrf()` al entrar (para writes posteriores).

## Verificación

- [x] `pnpm tsc` sin errores.
- [x] `pnpm build:vercel` genera `frontend/dist` sin errores.
- [x] Backend: `manage.py check` sin issues y 7 tests de auth en verde
      (`common.tests.test_auth_views`).
- [ ] Flujo manual en la demo: entrar sin sesión → `/login` React → login → dashboard → logout.

## Notas de despliegue

- En la VM ya está `SameSite=None` + `Secure` y `SESSION_COOKIE_DOMAIN=.init.com.mx`.
- En `avant.init.com.mx` (mismo site que la API) las cookies son first-party: 100% sólido.
- En `panoptes-app.vercel.app` son third-party: Chrome/Firefox OK; Safari puede bloquear
  cookies de terceros. Para demo se recomienda el dominio propio.

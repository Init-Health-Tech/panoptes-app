# Deploy separado: Frontend (Vercel) + Backend (VM)

## Dominios

| Pieza | URL |
|-------|-----|
| Frontend SPA | https://avant.init.com.mx |
| API Django | https://api.avant.init.com.mx |

Login/logout siguen en el API (`/login/`, `/logout/`). Tras autenticarse, el usuario vuelve al frontend.

## 1. Backend (VM)

1. Apunta DNS `api.avant.init.com.mx` a la VM (A/AAAA) y termina TLS (Caddy/Nginx + Let’s Encrypt).
2. Usa `backend/.env.production.example` como base:

```bash
ALLOWED_HOSTS=api.avant.init.com.mx
FRONTEND_URL=https://avant.init.com.mx
CORS_ALLOWED_ORIGINS=https://avant.init.com.mx
CSRF_TRUSTED_ORIGINS=https://avant.init.com.mx
SESSION_COOKIE_DOMAIN=.init.com.mx
CSRF_COOKIE_DOMAIN=.init.com.mx
```

3. Migraciones y seed (si aplica):

```bash
python manage.py migrate
python manage.py collectstatic --noinput
# gunicorn / systemd / docker compose solo con backend+db+redis+broker
```

4. El proxy debe enviar `X-Forwarded-Proto: https` (ya hay `SECURE_PROXY_SSL_HEADER`).

Admin Django: `https://api.avant.init.com.mx/admin/`

## 2. Frontend (Vercel)

1. Importa este repo en Vercel (root = monorepo).
2. `vercel.json` ya define build/output/SPA fallback.
3. Variable de entorno **Production** (y Preview si quieres) — **obligatoria en Build**:

```
API_BASE_URL=https://api.avant.init.com.mx
```

   Sin ella el SPA llama `/api` en el propio `*.vercel.app`, recibe el `index.html` y se rompe.
   Tras cambiarla: **Redeploy** (el valor se inyecta en el build de webpack).

4. Dominio custom: `avant.init.com.mx` → Vercel.

5. Mientras uses el preview `https://panoptes-app.vercel.app`, añade ese origen en el backend:

```
CORS_ALLOWED_ORIGINS=https://avant.init.com.mx,https://panoptes-app.vercel.app
CSRF_TRUSTED_ORIGINS=https://avant.init.com.mx,https://panoptes-app.vercel.app
```

Build local de prueba:

```bash
API_BASE_URL=https://api.avant.init.com.mx pnpm run build:vercel
# salida en frontend/dist
```

## 3. Cookies / CORS

- Cookies de sesión/CSRF con `Domain=.init.com.mx` se comparten entre `avant.` y `api.avant.`.
- CORS permite origen `https://avant.init.com.mx` con credenciales.
- El cliente axios usa `withCredentials: true` y `baseURL` = `API_BASE_URL`.

## 4. Local (sin split)

Sin `API_BASE_URL` / sin `FRONTEND_URL` el comportamiento sigue siendo monolito same-origin (`localhost:8000`).

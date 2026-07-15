# Deploy separado: Frontend (Vercel) + Backend (VM)

## Dominios

| Pieza | URL |
|-------|-----|
| Frontend SPA | https://avant.init.com.mx |
| API Django | https://api.avant.init.com.mx |

Login/logout siguen en el API (`/login/`, `/logout/`). Tras autenticarse, el usuario vuelve al frontend.

## 1. Backend (VM)

Puerto del API en la VM (loopback, raro para no chocar con otros backends):

```text
127.0.0.1:58427  →  contenedor gunicorn :8000
```

> Nota: `100000` no es un puerto válido (máximo `65535`). Usamos **58427**.

1. Apunta DNS `api.avant.init.com.mx` a la VM y termina TLS (Caddy/Nginx → `http://127.0.0.1:58427`).
2. Copia `backend/.env.production.example` → `backend/.env` en el servidor y rellena secretos.
3. Arranque:

```bash
docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

4. El proxy debe enviar `X-Forwarded-Proto: https` (ya hay `SECURE_PROXY_SSL_HEADER`).

Ejemplo Caddy:

```caddy
api.avant.init.com.mx {
  reverse_proxy 127.0.0.1:58427
}
```

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

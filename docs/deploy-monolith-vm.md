# Panoptes MONOLITO en la VM (todo en un dominio)

Frontend **y** backend en el **mismo origen** (`avant.init.com.mx`). Django sirve el SPA
de React (bundles de webpack via WhiteNoise) y la API juntos. Al ser mismo origen **no hay
CORS ni cookies cross-subdominio**: el login deja de dar guerra.

- Contenedor único de app en `127.0.0.1:58427` (loopback, puerto raro).
- Red y volumen propios (`panoptes_internal`, `panoptes_pgdata`): no chocan con Odoo/Artemis/Overleaf.
- Nginx: `avant.init.com.mx` → `http://127.0.0.1:58427`.

Ruta del repo en la VM (ajústala si la tuya difiere): `/opt/apps/panoptes-app`.

---

## 0. Borrar lo que montamos solo del backend (limpieza)

El stack se llama `panoptes-prod`, así que lo bajamos por nombre. Esto **NO toca** tus otras
apps (Odoo, Artemis, Overleaf) porque cada una vive en su propio proyecto/red/volumen.

```bash
cd /opt/apps/panoptes-app

# Baja el stack anterior. Quita imágenes construidas y contenedores huérfanos.
# (Conserva el volumen de la DB panoptes_pgdata: tus datos siguen ahí.)
docker compose -f docker-compose.prod.yml down --rmi local --remove-orphans

# ¿Quieres EMPEZAR DE CERO la base de datos (borra datos y arregla líos de password)?
# Solo si estás seguro:
docker volume rm panoptes-prod_panoptes_pgdata 2>/dev/null || docker volume rm panoptes_pgdata 2>/dev/null || true
```

Comprueba que no quede nada de Panoptes escuchando ni ocupando el puerto:

```bash
docker ps --filter "name=panoptes-prod"     # debe salir vacío
ss -tulpn | grep 58427 || echo "puerto 58427 libre"
```

Limpieza opcional de basura de Docker (segura, no borra volúmenes en uso ni de otras apps):

```bash
docker image prune -f
docker builder prune -f
```

> Regla de oro para no pelear con otras apps: **nunca** uses `docker system prune -a --volumes`
> en esta VM (eso borra imágenes/volúmenes de TODAS las apps). Usa siempre `-f docker-compose.prod.yml`
> y borrados por nombre `panoptes-*`.

---

## 1. Configurar `.env` (mismo dominio)

```bash
cd /opt/apps/panoptes-app
cp backend/.env.production.example backend/.env
nano backend/.env
chmod 600 backend/.env
```

Rellena al menos:

- `SECRET_KEY` = algo largo y aleatorio (`python -c "import secrets;print(secrets.token_urlsafe(50))"`).
- `POSTGRES_PASSWORD` = una contraseña fuerte.
- `DATABASE_URL` = `postgres://panoptes:<misma-password>@db:5432/panoptes`.
- `ALLOWED_HOSTS=avant.init.com.mx`
- `CSRF_TRUSTED_ORIGINS=https://avant.init.com.mx`

Deja **vacías/comentadas** `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `SESSION_COOKIE_DOMAIN`,
`CSRF_COOKIE_DOMAIN` (son solo para el deploy separado con Vercel).

> Si reusas el volumen de DB anterior, `POSTGRES_PASSWORD` **debe** coincidir con la que se
> creó la primera vez, o el backend dará `password authentication failed`. Si no coincide,
> borra el volumen (paso 0) o resetea la password del usuario `panoptes` dentro del contenedor db.

---

## 2. Levantar el monolito

```bash
cd /opt/apps/panoptes-app
git pull

# Build (compila el frontend dentro de la imagen) + arranque.
docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build

# migrate + collectstatic ya corren solos al arrancar (ver command del compose),
# pero puedes forzarlos:
docker compose -f docker-compose.prod.yml --env-file backend/.env exec -T backend python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml --env-file backend/.env exec -T backend python manage.py collectstatic --noinput

docker compose -f docker-compose.prod.yml ps
ss -tulpn | grep 58427     # debe aparecer escuchando en 127.0.0.1:58427
```

Prueba local en la VM (sin pasar por Nginx):

```bash
curl -sI http://127.0.0.1:58427/login/ | head -5
```

---

## 3. Nginx + TLS para `avant.init.com.mx`

```bash
sudo tee /etc/nginx/sites-available/avant.init.com.mx > /dev/null <<'EOF'
server {
    listen 80;
    server_name avant.init.com.mx;

    # Archivos grandes (imports de Excel, etc.)
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:58427;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # necesario: SECURE_PROXY_SSL_HEADER
        proxy_read_timeout 120s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/avant.init.com.mx /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Certificado (redirige HTTP->HTTPS automáticamente):
sudo certbot --nginx -d avant.init.com.mx
```

### DNS y Vercel (importante)

- Apunta `avant.init.com.mx` **A** → IP de la VM (`62.238.32.245`) y, si usas IPv6, **AAAA** → la de la VM.
- **Quita** `avant.init.com.mx` del proyecto de Vercel (Project → Settings → Domains), o Vercel
  seguirá respondiendo ese dominio y competirá con la VM.
- El subdominio `api.avant.init.com.mx` ya no se necesita en monolito (puedes dejarlo o borrarlo).

Verifica desde tu Mac:

```bash
curl -sI https://avant.init.com.mx/login/ | head -5
```

---

## 4. Datos demo y usuario demo (7 días)

```bash
cd /opt/apps/panoptes-app
DC="docker compose -f docker-compose.prod.yml --env-file backend/.env exec -T backend"

# Módulos/paquetes base (idempotente)
$DC python manage.py seed_modules
$DC python manage.py seed_packages

# Crear org + usuario demo que expira en 7 días (imprime la contraseña una vez)
$DC python manage.py provision_demo demo@avant.init.com.mx --name "Avant Demo" --days 7 --packages pkg_full

# Sembrar datos de ejemplo DENTRO de esa org demo (usa el slug que imprimió provision_demo)
$DC python manage.py seed_demo --org avant-demo --profile clinical
```

> `--packages` admite: `pkg_full`, `pkg_instrumental`, `pkg_inventory`, `pkg_logistics`.
> `--profile` admite: `clinical`, `mixed`, `logistics`.

---

## 5. Día a día

```bash
cd /opt/apps/panoptes-app

# Actualizar código y redeploy
git pull
docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build

# Logs
docker compose -f docker-compose.prod.yml logs -f --tail=100 backend

# Reiniciar solo la app
docker compose -f docker-compose.prod.yml restart backend

# Bajar TODO el stack Panoptes (no toca otras apps)
docker compose -f docker-compose.prod.yml down
```

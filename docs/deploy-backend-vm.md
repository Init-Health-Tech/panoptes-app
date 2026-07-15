# Backend Panoptes en la VM (Docker manual)

Frontend = Vercel. Backend = Docker Compose en la VM (sin GitHub Actions).

Puerto API: `127.0.0.1:58427` → Nginx → `api.avant.init.com.mx`

---

## 1. Una sola vez en la VM

### Clone del repo

Si el repo es privado, usa un Deploy Key (solo lectura) o HTTPS con token:

```bash
mkdir -p /opt/panoptes
# Opción Deploy Key:
ssh-keygen -t ed25519 -C "panoptes-vm" -f /root/.ssh/panoptes_github_deploy -N ""
cat /root/.ssh/panoptes_github_deploy.pub
# → GitHub → Settings → Deploy keys (sin write)

cat >> /root/.ssh/config <<'EOF'
Host github.com-panoptes
  HostName github.com
  User git
  IdentityFile /root/.ssh/panoptes_github_deploy
  IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config

git clone git@github.com-panoptes:Init-Health-Tech/panoptes-app.git /opt/panoptes
```

### `.env` de producción

```bash
cp /opt/panoptes/backend/.env.production.example /opt/panoptes/backend/.env
nano /opt/panoptes/backend/.env
chmod 600 /opt/panoptes/backend/.env
```

### Arranque

```bash
cd /opt/panoptes
docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput
docker compose -f docker-compose.prod.yml ps
ss -tulpn | grep 58427
```

### Nginx

```bash
cat > /etc/nginx/sites-available/api.avant.init.com.mx <<'EOF'
server {
    listen 80;
    server_name api.avant.init.com.mx;

    location / {
        proxy_pass http://127.0.0.1:58427;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/api.avant.init.com.mx /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
# certbot --nginx -d api.avant.init.com.mx
```

DNS: `api.avant.init.com.mx` A → IP de la VM.

---

## 2. Cada vez que actualices el código

```bash
cd /opt/panoptes
git pull
docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput
```

---

## 3. Comandos útiles

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f --tail=100 backend

# Reiniciar
docker compose -f docker-compose.prod.yml restart backend

# Parar todo el stack Panoptes (no toca Odoo/Artemis/Overleaf)
docker compose -f docker-compose.prod.yml down
```

---

## 4. Frontend (Vercel)

```
API_BASE_URL=https://api.avant.init.com.mx
```

Y en `backend/.env` de la VM, CORS/CSRF con el origen del FE.

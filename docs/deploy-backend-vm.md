# Deploy del backend Panoptes a la VM (Hetzner)

Frontend = Vercel. Backend = esta VM vía GitHub Actions + SSH.

Puerto API en la VM: `127.0.0.1:58427` → Nginx → `api.avant.init.com.mx`

---

## Resumen: 2 llaves SSH distintas

| Llave | Para qué | Dónde va la pública | Dónde va la privada |
|-------|----------|--------------------|--------------------|
| **A. Actions → VM** | Que GitHub Actions entre por SSH | `~/.ssh/authorized_keys` en la VM | Secret `DEPLOY_SSH_KEY` en GitHub |
| **B. VM → GitHub** | Que la VM haga `git pull` del repo | Deploy Key en el repo de GitHub | Archivo en la VM (`~/.ssh/...`) |

---

## 1. En la VM (una sola vez)

### 1.1 Carpeta + llave para clonar el repo (llave B)

```bash
mkdir -p /opt/panoptes /root/.ssh
chmod 700 /root/.ssh

ssh-keygen -t ed25519 -C "panoptes-vm-github-deploy" \
  -f /root/.ssh/panoptes_github_deploy -N ""

echo "----- Copia esta PUBLICA a GitHub → Settings → Deploy keys -----"
cat /root/.ssh/panoptes_github_deploy.pub
```

En GitHub → repo **Init-Health-Tech/panoptes-app** → **Settings → Deploy keys → Add**:

- Title: `hetzner-vm-panoptes`
- Key: pega la **pública**
- **Allow write access: NO** (solo lectura)

Config SSH en la VM:

```bash
cat >> /root/.ssh/config <<'EOF'
Host github.com-panoptes
  HostName github.com
  User git
  IdentityFile /root/.ssh/panoptes_github_deploy
  IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config

git clone git@github.com-panoptes:Init-Health-Tech/panoptes-app.git /opt/panoptes
cd /opt/panoptes
```

### 1.2 Archivo `.env` de producción (nunca en git)

```bash
cp /opt/panoptes/backend/.env.production.example /opt/panoptes/backend/.env
nano /opt/panoptes/backend/.env
# Cambia SECRET_KEY, POSTGRES_PASSWORD, CORS si hace falta
chmod 600 /opt/panoptes/backend/.env
```

### 1.3 Primer arranque manual

```bash
cd /opt/panoptes
docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput
docker compose -f docker-compose.prod.yml ps

# Debe escuchar solo en loopback:
ss -tulpn | grep 58427
```

### 1.4 Nginx (mismo patrón que Odoo/Artemis)

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

# TLS (si usas certbot):
# certbot --nginx -d api.avant.init.com.mx
```

DNS: `api.avant.init.com.mx` tipo A → IP de esta VM.

### 1.5 Llave para que Actions entre a la VM (llave A)

```bash
ssh-keygen -t ed25519 -C "github-actions-panoptes" \
  -f /root/.ssh/panoptes_gha_deploy -N ""

# Autoriza la pública en la VM
cat /root/.ssh/panoptes_gha_deploy.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

echo "----- Copia esta PRIVADA a GitHub Secret DEPLOY_SSH_KEY -----"
cat /root/.ssh/panoptes_gha_deploy

# Opcional: borra la privada del disco después de guardarla en GitHub
# shred -u /root/.ssh/panoptes_gha_deploy
```

Prueba desde tu laptop (con la privada temporal):

```bash
ssh -i panoptes_gha_deploy root@IP_DE_LA_VM 'echo ok && hostname'
```

---

## 2. En GitHub (secrets)

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|--------|--------|
| `DEPLOY_HOST` | IP pública de la VM (o hostname) |
| `DEPLOY_USER` | `root` (o el usuario que uses) |
| `DEPLOY_SSH_KEY` | Contenido **completo** de la privada (`-----BEGIN OPENSSH PRIVATE KEY-----` …) |
| `DEPLOY_PORT` | `22` (opcional; el workflow ya usa 22 por defecto) |

El workflow ya está en: `.github/workflows/deploy-backend.yml`

Se dispara con:

- push a `main` que toque backend / compose / poetry
- o manual: **Actions → Deploy backend (VM) → Run workflow**

---

## 3. Qué hace el workflow en cada deploy

```text
SSH → /opt/panoptes
  git fetch + reset --hard origin/main
  docker compose -f docker-compose.prod.yml up -d --build
  migrate
  collectstatic
```

El `backend/.env` **no** se sobrescribe (vive solo en la VM).

---

## 4. Checklist rápido

- [ ] Deploy key (pública) en GitHub, clone en `/opt/panoptes` OK  
- [ ] `backend/.env` creado en la VM  
- [ ] Compose arriba y `ss` muestra `127.0.0.1:58427`  
- [ ] Nginx + DNS + HTTPS para `api.avant.init.com.mx`  
- [ ] Secrets `DEPLOY_*` en GitHub  
- [ ] En Vercel: `API_BASE_URL=https://api.avant.init.com.mx` + Redeploy  
- [ ] CORS/CSRF en `.env` incluyen el origen del frontend  

---

## 5. Si algo falla

```bash
# Logs
cd /opt/panoptes
docker compose -f docker-compose.prod.yml logs --tail=100 backend

# ¿Actions puede entrar?
# En GitHub Actions verás el log del step SSH

# ¿La VM puede pull?
cd /opt/panoptes && git fetch origin main
```

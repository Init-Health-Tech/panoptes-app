# Panoptes — INIT Health Tech

Plataforma web multi-tenant para trazabilidad RFID: inventario en tiempo real, maletas médicas, personal clínico y operaciones logísticas. Construida sobre [django-react-boilerplate](README.md).

## Requisitos

- Docker + Docker Compose
- Node 20+ y pnpm (solo si desarrollas frontend fuera de Docker)

## Arranque rápido (Docker)

```bash
make docker_up
make docker_migrate
docker compose exec backend python manage.py seed_modules
docker compose exec backend python manage.py seed_demo
```

- **App:** http://localhost:8000
- **Admin Django:** http://localhost:8000/admin/
- **Webpack dev server:** corre dentro del contenedor `frontend`; desde la raíz del repo usa `pnpm run dev` si trabajas en local (no desde `frontend/`).

## Deploy en VM (monolito, RECOMENDADO)

Frontend **y** API en el mismo dominio **https://avant.init.com.mx** (una sola imagen Docker).
Sin CORS ni cookies cross-subdominio: el login funciona sin líos.

- [docs/deploy-monolith-vm.md](docs/deploy-monolith-vm.md) — teardown, build full, Nginx, demo

## Deploy separado (Vercel + VM) — alternativa

Frontend en Vercel y API en `api.avant.init.com.mx` (VM). Requiere cookies cross-subdominio:

- [docs/deploy-vercel-vm.md](docs/deploy-vercel-vm.md) — dominios, CORS, cookies
- [docs/deploy-backend-vm.md](docs/deploy-backend-vm.md) — Docker Compose manual en la VM + Nginx

## Cuentas demo

| Email | Contraseña | Organización | Módulos |
|-------|------------|--------------|---------|
| `demo@init.health` | `demo1234` | INIT Health Demo | Todos |
| `clinica@init.health` | `demo1234` | INIT Clínica Demo | Inventario + médico |
| `logistica@init.health` | `demo1234` | INIT Logística Demo | Inventario + logística |

El usuario `demo@init.health` es superusuario (acceso al admin). Los demás son staff con rol acorde a su dominio.

## Módulos por organización

Los módulos se habilitan con `OrganizationModule`. El comando `seed_modules` crea el catálogo; `seed_demo` activa el subconjunto correcto por org.

| Código | Dominio |
|--------|---------|
| `inventory_realtime` | Tags RFID, lecturas, dashboard inventario |
| `medical_supplies` | Insumos vinculados a tags |
| `medical_kits` | Maletas y procedimientos |
| `medical_staff` | Doctores y técnicos |
| `logistics_catalog` | Productos, clientes, proveedores |
| `logistics_requisitions` | Requisiciones internas |
| `logistics_sales_purchases` | Órdenes de venta y compra |
| `instrumental_control` | Control instrumental: solicitudes, cotizaciones, despacho RFID/SKU, handheld |

El frontend usa `ModuleGuard` y la primera `OrganizationMembership` del usuario (sin selector de org activa).

## Webhook RFID (API key)

Lecturas externas entran por `POST /api/rfid-reads/` con autenticación por API key de organización.

**Header:** `X-Organization-Api-Key: <clave>`

Al ejecutar `seed_demo` por primera vez en cada org, se imprime la clave en consola (solo una vez). También puedes rotar claves desde Django admin (`OrganizationAPIKey`).

Ejemplo:

```bash
curl -X POST http://localhost:8000/api/rfid-reads/ \
  -H "Content-Type: application/json" \
  -H "X-Organization-Api-Key: TU_CLAVE" \
  -d '{"epc": "EPC-DEMO-999", "reader_id": "reader-1", "location": "Almacén Central"}'
```

El tag aparece en la UI de inventario de esa organización.

## Flujo OpenAPI → cliente TypeScript

Tras **cualquier** cambio en serializers o rutas de la API:

```bash
make docker_backend_update_schema   # genera schema.yml
make docker_frontend_update_api     # regenera frontend/js/api
```

En local sin Docker:

```bash
poetry run backend/manage.py spectacular --file schema.yml
pnpm run openapi-ts
```

## Tests

```bash
# Backend (Docker)
make docker_test

# Backend apps concretas (desde repo raíz, sin prefijo backend/)
make docker_test organizations inventory

# Frontend
pnpm run tsc
pnpm test
pnpm run lint
```

## Multi-tenancy

- Modelos de negocio heredan `OrganizationModel`.
- ViewSets de negocio usan `OrganizationViewSetMixin` (filtra queryset y asigna org en `create`).
- `OrganizationMiddleware` resuelve `request.organization` desde la membership del usuario.
- `users.UserViewSet` es global del boilerplate (gestión de usuarios), no filtrado por org.

## Apps Django

| App | Responsabilidad |
|-----|-----------------|
| `organizations` | Orgs, módulos, memberships, API keys |
| `inventory` | Tags RFID, eventos de lectura, webhook |
| `medical` | Doctores, técnicos, procedimientos, maletas |
| `logistics` | Catálogo, requisiciones, ventas, compras |

## Rutas frontend principales

`/`, `/inventory`, `/inventory/:id`, `/supply-kits`, `/procedures`, `/doctors`, `/technicians`, `/products`, `/clients`, `/providers`, `/requisitions`, `/sales-orders`, `/purchase-orders`, `/users`

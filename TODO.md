# Panoptes — Plan de implementación

> **Estado:** Fase 4 completada. Siguiente: Fase 5 — Frontend (CRUD forms, detalle inventario, route guards).
>
> **Alcance explícito:** login/auth existente intacto. Sin drivers RFID ni hardware real. Solo capa de datos + API + frontend sobre el boilerplate.

---

## Decisiones de arquitectura — confirmadas

| # | Decisión | Resolución |
|---|----------|------------|
| D1 | Multi-org por usuario | M2M con `OrganizationMembership` + rol. Sin selector de org activa en sesión por ahora; el frontend asume la primera/única membership. |
| D2 | Permisos por rol | `has_module_and_role(module_code, allowed_roles)` — factory reutilizable que valida módulo activo **y** rol. Variante `has_module_and_role_for_view` para códigos en URL kwargs. |
| D3 | Apps Django | `organizations`, `inventory`, `medical`, `logistics`. Cada app declara `module_code` o `module_codes` en su `AppConfig`. |
| D4 | Runner de tests | `manage.py test` + `APITestCase` + `TestCaseUtils`. Sin pytest. |
| D5 | Webhook RFID | API key por org (`OrganizationAPIKey`), header `X-Organization-Api-Key`, rotación vía `rotate_key()`, campo `last_used_at`. Auth en `OrganizationAPIKeyAuthentication`. |

---

## Fase 1 — Core: Organización, Módulos y Multi-tenancy

### Objetivo
Fundamento multi-tenant y sistema de módulos habilitables por organización. Todo lo demás se construye encima.

### Tareas

#### 1.1 Apps y modelos base
- [x] Crear app `organizations` con modelos:
  - [x] `Organization` (nombre, slug único, industry_type, is_active, created)
  - [x] `Module` (code único, name, description)
  - [x] `OrganizationModule` (organization FK, module FK, is_active, activated_at; unique_together org+module)
- [x] Management command `seed_modules` con códigos fijos:
  - `inventory_realtime`, `medical_supplies`, `medical_kits`, `medical_staff`, `logistics_requisitions`, `logistics_sales_purchases`, `logistics_catalog`
- [x] Extender `users.User` vía modelo intermedio `OrganizationMembership`:
  - [x] FK a `Organization`, campo `role` (choices: admin, warehouse, technician, doctor, logistics_coordinator)
  - [x] Helpers `user.organization`, `user.role` (primera membership por `created`)
- [x] `OrganizationAPIKey` con generación, rotación y `last_used_at` (prep Fase 2 / D5)

#### 1.2 Infraestructura multi-tenant
- [x] `OrganizationModel` abstract base (FK `organization`, `IndexedTimeStampedModel`)
- [x] `OrganizationQuerySet` / `OrganizationManager` con `.for_organization(org)`
- [x] Middleware `OrganizationMiddleware`: resolver org del usuario autenticado → `request.organization`
- [x] Mixin DRF `OrganizationViewSetMixin`: filtrar queryset por `request.organization`; asignar org en `perform_create`
- [x] Registrar apps en `INSTALLED_APPS` y middleware en settings
- [x] Stubs `inventory`, `medical`, `logistics` con `module_code`/`module_codes` en `AppConfig`

#### 1.3 Sistema de módulos
- [x] Permiso DRF `has_module_and_role(module_code, allowed_roles)` — factory reutilizable
- [x] Permiso DRF `has_module_and_role_for_view(kwarg_name)` — para códigos en URL
- [x] `ActiveModulesView` → `GET /api/active-modules/`
- [x] `ModuleProbeView` → `GET /api/modules/{code}/probe/` (verificación de acceso)
- [x] Django Admin: inline `OrganizationModule`, `OrganizationMembership`, `OrganizationAPIKey` en `Organization`

#### 1.4 Tests (seguridad multi-tenant)
- [x] Test: módulos de org B no visibles para usuario org A (`active-modules`, `module-probe`)
- [x] Test: endpoint de módulo deshabilitado → 403
- [x] Test: `GET /api/active-modules/` retorna solo módulos activos de la org del usuario
- [x] Test: superuser puede acceder al admin de organizaciones
- [x] Tests: API key generate/authenticate/rotate

### Criterios de verificación — Fase 1

```bash
# Migraciones
make docker_makemigrations
make docker_migrate

# Seed de módulos (comando a crear)
docker compose run --rm backend python manage.py seed_modules

# Tests backend
make docker_test organizations users

# Schema OpenAPI + cliente TS
make docker_backend_update_schema
make docker_frontend_update_api
pnpm run tsc          # sin errores de tipos en frontend
```

**Manual:**
- [ ] Crear 2 organizaciones en Django Admin con módulos distintos
- [ ] Asignar usuarios a cada org con roles diferentes
- [ ] Confirmar que `GET /api/active-modules/` difiere entre usuarios
- [ ] Confirmar 403 al llamar un endpoint protegido con módulo desactivado

---

## Fase 2 — Core: RFID e Inventario en tiempo real

### Objetivo
Modelos RFID, historial de lecturas, webhook de ingesta y API de inventario paginada.

### Tareas

#### 2.1 App `inventory`
- [x] Modelo `RFIDTag` (code unique/org, item_type, status, last_location, last_read_at)
- [x] Modelo `RFIDReadEvent` (tag, timestamp, location, reader_source, event_type)
- [x] Índices en `(organization, status)`, `(organization, code)`, `(tag, timestamp)`

#### 2.2 API
- [x] `RFIDTagViewSet` — CRUD + filtros status, location, item_type
- [x] `RFIDReadEventViewSet` — list/retrieve + filtro por tag
- [x] Webhook `POST /api/rfid-reads/` con API key (`X-Organization-Api-Key`)
- [x] `GET /api/inventory/dashboard-stats/` — KPIs de inventario
- [x] Permiso `has_module_and_role("inventory_realtime")` en endpoints UI

#### 2.3 Admin y utilidades
- [x] Django Admin para `RFIDTag` y `RFIDReadEvent`

#### 2.4 Tests
- [x] Webhook crea/actualiza tag + evento
- [x] Filtros, paginación, aislamiento multi-tenant, 403 sin módulo

#### 2.5 Frontend Stitch (parcial — inventario)
- [x] Design tokens Panoptes en `frontend/css/style.css` (colores DESIGN.md)
- [x] Fuentes Plus Jakarta Sans + Inter + Material Symbols en `base.html`
- [x] `AppLayout` + `Sidebar` dinámico por módulos activos
- [x] Dashboard con KPIs (`main_dashboard_panoptes`)
- [x] Pantalla Inventario con tabla/filtros (`real_time_inventory_panoptes`)

### Criterios de verificación — Fase 2

```bash
make docker_makemigrations
make docker_migrate
make docker_test inventory

make docker_backend_update_schema
make docker_frontend_update_api
```

**Manual (curl o Swagger):**
- [ ] `POST /api/rfid-reads/` con API key válida → 201, tag actualizado
- [ ] `GET /api/rfid-tags/?status=en_stock&location=...` → resultados filtrados y paginados
- [ ] Usuario sin módulo inventario → 403 en todos los endpoints RFID

---

## Fase 3 — Módulo médico

### Objetivo
Procedimientos, personal médico/técnico, maletas (SupplyKit) vinculadas a tags RFID.

### Tareas

#### 3.1 App `medical`
- [x] `Procedure`, `Doctor`, `Technician`, `ProcedureAssignment`, `SupplyKit`, `SupplyKitTag`
- [x] Validación tags misma org en `SupplyKitTag`

#### 3.2 API
- [x] CRUD `/api/procedures/`, `/api/doctors/`, `/api/technicians/`, `/api/procedure-assignments/`
- [x] CRUD `/api/supply-kits/` + actions `add-tags` / `remove-tags`
- [x] Permisos: `medical_supplies`, `medical_kits`, `medical_staff`
- [x] `GET /api/medical/dashboard-stats/`

#### 3.3 Admin
- [x] Todos los modelos registrados con filtros

#### 3.4 Tests
- [x] CRUD, tags cross-org, 403 sub-módulo, aislamiento multi-tenant

#### 3.5 Frontend Stitch
- [x] `/supply-kits` — cards estilo `maleta_builder_panoptes`
- [x] `/procedures` — tabla de procedimientos
- [x] `/doctors` — directorio estilo `management_directory_panoptes`
- [x] KPIs médicos en dashboard

### Criterios de verificación — Fase 3

```bash
make docker_makemigrations
make docker_migrate
make docker_test medical

make docker_backend_update_schema
make docker_frontend_update_api
```

**Manual:**
- [ ] Org con solo `medical_kits` activo puede gestionar maletas pero no doctores (403)
- [ ] Crear maleta, asociar tags RFID existentes, cambiar estado a `en_transito`

---

## Fase 4 — Módulo logístico

### Objetivo
Catálogos, requisiciones, órdenes de venta y compra.

### Tareas

#### 4.1 App `logistics`
- [x] `Product` (sku unique/org, name, category, unit, organization)
- [x] `Client` (business_name, contact, organization)
- [x] `Provider` (business_name, contact, organization)
- [x] `Requisition` (origin, destination, status, requested_at, organization)
- [x] `RequisitionLine` (requisition FK, product FK, quantity)
- [x] `SalesOrder` (client FK, status, total, ordered_at, organization)
- [x] `SalesOrderLine` (sales_order FK, product FK, quantity, unit_price)
- [x] `PurchaseOrder` (provider FK, status, total, ordered_at, organization)
- [x] `PurchaseOrderLine` (purchase_order FK, product FK, quantity, unit_price)

#### 4.2 API
- [x] CRUD `/api/products/`, `/api/clients/`, `/api/providers/`
- [x] CRUD `/api/requisitions/` + lines nested o serializer anidado
- [x] CRUD `/api/sales-orders/`, `/api/purchase-orders/` + lines
- [x] Permisos:
  - [x] `logistics_catalog` → products, clients, providers
  - [x] `logistics_requisitions` → requisitions
  - [x] `logistics_sales_purchases` → sales-orders, purchase-orders
- [x] Filtros por status en requisitions y orders

#### 4.3 Admin
- [x] Inlines para líneas de requisition/orders

#### 4.4 Tests
- [x] Validación: líneas referencian productos de la misma org
- [x] Transiciones de estado (si se implementan restricciones)
- [x] 403 por sub-módulo desactivado
- [x] Aislamiento multi-tenant

#### 4.5 Frontend Stitch
- [x] `/products` — catálogo estilo `catalogs_panoptes_rfid`
- [x] `/requisitions` — kanban + tabla filtrable estilo `logistics_kanban_panoptes`
- [x] `/sales-orders` — tabla estilo `commercial_overview_panoptes`
- [x] KPIs logísticos en dashboard
- [x] `seed_demo` con productos, requisiciones, cliente, orden de venta/compra

### Criterios de verificación — Fase 4

```bash
make docker_makemigrations
make docker_migrate
make docker_test logistics

make docker_backend_update_schema
make docker_frontend_update_api
```

**Manual:**
- [ ] Crear requisición con líneas, filtrar por `status=solicitada`
- [ ] Org sin `logistics_sales_purchases` → 403 en sales/purchase orders

---

## Fase 5 — Frontend

### Objetivo
Navegación dinámica por módulos, pantallas CRUD por entidad, dashboard con KPIs condicionales.

### Tareas

#### 5.1 Infraestructura frontend
- [x] Loader `modulesLoader` — `GET /api/active-modules/` en root route
- [x] `ModulesContext` para módulos activos
- [x] Mapa `moduleCode → navItems` en `frontend/js/config/modules.ts`
- [x] Sidebar dinámico según módulos activos
- [x] `AppLayout` compartido (sidebar + content)

#### 5.2 Dashboard (`/`)
- [x] KPIs inventario condicionales (`inventory_realtime`)
- [x] KPIs maletas en tránsito (`medical_kits`)
- [x] KPIs requisiciones pendientes (`logistics_requisitions`)
- [x] Endpoint `GET /api/inventory/dashboard-stats/`

#### 5.3 Pantallas por entidad
- [x] `/inventory` — lista + filtros (falta detalle `/inventory/:id`)

| Ruta | Módulo requerido | Entidad |
|------|------------------|---------|
| `/inventory` | inventory_realtime | RFID Tags |
| `/inventory/:id` | inventory_realtime | Tag detalle + historial lecturas |
| `/procedures` | medical_supplies | Procedures |
| `/doctors` | medical_staff | Doctors |
| `/technicians` | medical_staff | Technicians |
| `/supply-kits` | medical_kits | Supply Kits |
| `/products` | logistics_catalog | Products |
| `/clients` | logistics_catalog | Clients |
| `/providers` | logistics_catalog | Providers |
| `/requisitions` | logistics_requisitions | Requisitions |
| `/sales-orders` | logistics_sales_purchases | Sales Orders |
| `/purchase-orders` | logistics_sales_purchases | Purchase Orders |

Por pantalla:
- [x] `loader` en route (patrón `usersLoader`) — inventory, medical, logistics
- [x] Lista paginada (limit/offset como Users) — inventory, medical, logistics
- [ ] Formulario create/edit (componentes reutilizables: Input, Select, Button — extraer de estilos existentes)
- [x] Redirect a login en 401/403 (patrón existente en loaders)
- [ ] Route guard: no registrar ruta si módulo inactivo **o** redirect a home

#### 5.4 Branding Panoptes
- [x] Branding "Panoptes" en sidebar y dashboard
- [x] Design tokens desde `stitch_panoptes_rfid_medical_logistics/clinical_precision_grid/DESIGN.md`

#### 5.5 Tests frontend
- [ ] Test: sidebar muestra/oculta links según módulos mockeados
- [x] Test: dashboard oculta/muestra KPIs según stats
- [x] `Dashboard.spec.tsx` reemplaza `Home.spec.tsx`

### Mapa Stitch → React (plan de integración visual)

| Mockup Stitch | Pantalla React | Fase | Estado |
|---------------|----------------|------|--------|
| `main_dashboard_panoptes` | `/` Dashboard | 2/5 | Integrado |
| `real_time_inventory_panoptes` | `/inventory` | 2/5 | Integrado |
| `maleta_builder_panoptes` | `/supply-kits` | 3 | Integrado |
| `management_directory_panoptes` | `/doctors`, `/technicians` | 3 | Integrado (doctors) |
| `logistics_kanban_panoptes` | `/requisitions` | 4 | Integrado |
| `catalogs_panoptes_rfid` | `/products`, `/clients` | 4 | Integrado (products) |
| `commercial_overview_panoptes` | `/sales-orders` | 4 | Integrado |
| `login_panoptes_rfid` | Django admin login | — | Existente (no tocar) |

### Criterios de verificación — Fase 5

```bash
make docker_backend_update_schema
make docker_frontend_update_api

pnpm run lint
pnpm run tsc
pnpm test

make docker_up   # smoke test integrado
```

**Manual:**
- [ ] Usuario org clínica (solo módulos médicos + inventario): sidebar sin links logísticos
- [ ] Usuario org logística: sidebar sin links médicos (excepto inventario)
- [ ] CRUD completo de al menos una entidad por módulo vía UI
- [ ] Dashboard refleja KPIs correctos por org

---

## Fase 6 — Integración final y hardening

### Tareas
- [ ] `make docker_test` — suite completa verde
- [ ] Revisar que ningún ViewSet de negocio exponga queryset global sin filtro org
- [ ] Documentar en README (sección Panoptes): setup, seed_modules, API key RFID, flujo OpenAPI
- [ ] Fixture/demo data command `seed_demo` (1 org clínica + 1 org logística + tags + kits + requisiciones) para demos

### Criterios de verificación — Fase 6

```bash
make docker_test
make docker_backend_update_schema
make docker_frontend_update_api
pnpm run lint && pnpm run tsc && pnpm test
pre-commit run --all-files   # si entorno local lo permite
```

**Manual E2E:**
- [ ] Flujo: lectura RFID → tag aparece en inventario UI
- [ ] Flujo: armar maleta → asignar tags → cambiar a en_transito → visible en dashboard
- [ ] Flujo: crear requisición → aparece en KPI pendientes

---

## Convenciones del repo (recordatorio)

| Área | Convención |
|------|------------|
| Backend apps | Una app por dominio; routes en `{app}/routes.py`; registro en `project_name/urls.py` |
| Modelos | Heredar `IndexedTimeStampedModel` + `OrganizationModel` |
| API | ViewSets DRF + serializers; paginación LimitOffset (PAGE_SIZE=10) |
| OpenAPI | Tras **cada** cambio de API: `make docker_backend_update_schema` → `make docker_frontend_update_api` |
| Tests | `TestCaseUtils` + `APITestCase` + `model_bakery`; correr con `make docker_test {app}` |
| Frontend | React Router loaders + cliente `@/js/api` generado; Tailwind; sin nueva UI lib |
| Auth | **No tocar** login/session existente; solo extender User con membership |

---

## Orden de ejecución (resumen)

```
Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6
  │         │         │         │         │
  Org/     RFID/    Medical   Logistics  Frontend
  Module   Invent                         + KPIs
```

**No iniciar implementación hasta confirmación del product owner y resolución de decisiones D1–D5.**

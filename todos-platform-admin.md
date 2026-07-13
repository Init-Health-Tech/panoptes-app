# Panoptes — Platform Admin, Demos multi-cliente y telemetría

> **Estado:** Fase 0–1 en curso (modelos + API platform + UI `/platform` + gráficas dashboard + telemetría básica + CTA demo).  
> **Producto actual en foco:** Control de instrumental (demo Avant).  
> **Objetivo:** que INIT pueda dar de alta clientes/demos, asignar productos, monitorear uso y convertir demos a licencia completa.

---

## Contexto

Hoy el sistema ya es multi-tenant (`Organization` + `OrganizationModule` + memberships), pero:

- Las orgs demo se crean solo vía `seed_demo` (fijas).
- No hay caducidad de demo ni CTA a ventas.
- No hay dashboard de **plataforma** (solo Django Admin).
- No hay telemetría de uso / IP / módulos por cliente.
- `Module` es catálogo técnico, no “producto vendible / adaptable”.

Avant es el primer cliente demo (instrumental). El diseño debe permitir **N clientes**, cada uno con su bundle de productos.

---

## Decisiones recomendadas (incluidas)

| # | Tema | Recomendación |
|---|------|----------------|
| R1 | Quién administra | Solo usuarios **platform staff** (`User.is_superuser` o flag `is_platform_admin`). Los admins de cliente **no** ven otras orgs. |
| R2 | Demos | Org con `account_type=demo`, `demo_expires_at`, `demo_contact_email`. Usuarios demo **sin** `is_staff` (no entran a `/admin`). |
| R3 | Productos vendibles | Nuevo `ProductPackage` (bundle comercial) → N `Module`. Se asigna el package a la org; se pueden activar módulos sueltos o “adaptar” con `OrganizationModuleConfig` (JSON de overrides). |
| R4 | Purge demo | Soft-disable primero; hard-delete de datos tenant con comando/API `purge_demo` (nunca toca orgs `account_type=customer` sin confirmación explícita). |
| R5 | Caducidad | Middleware bloquea UI API (salvo endpoints de “solicitar licencia” y logout). Banner + mailto `sales@init.com.mx` con asunto/cuerpo prellenados. |
| R6 | Telemetría | Middleware ligero → `UsageEvent` (org, user, path, method, ip, module_code, user_agent, created). Agregados diarios en `UsageDailyRollup` para gráficas. |
| R7 | IP | Capturar `X-Forwarded-For` / `REMOTE_ADDR` en login + cada request autenticado (muestreo o siempre; empezar siempre, luego muestrear si hay volumen). |
| R8 | Correo demo | Al crear demo: generar email `demo+{slug}@…` o el que indique el admin; password temporal de un solo uso; opción de enviar credenciales (SMTP). En local: loggear el mail. |
| R9 | Dashboard cliente | Además de KPIs: gráficas de actividad (tags por estado, flujo instrumental por etapa, tendencia 7/30 días). |
| R10 | Dashboard plataforma | Lista de clientes, demos por vencer, uso por módulo, IPs recientes, paquetes activos. |
| R11 | Privacidad | Retener eventos crudos 90 días; rollups indefinidos. Documentar en privacidad interna. |
| R12 | No mezclar con logística Product | El `Product` de logistics es SKU del cliente. Los productos **SaaS** viven en `ProductPackage`. |

---

## Fases y tasks

### Fase 0 — Documento + cimientos de modelo

- [x] Este documento (`todos-platform-admin.md`)
- [x] Extender `Organization` (`account_type`, demo fields, contacto, `sales_owner`)
- [x] `ProductPackage` + `ProductPackageModule`
- [x] `OrganizationProduct` (package + `config` JSON + notes)
- [x] `UsageEvent` + `UsageDailyRollup` + `PlatformAuditLog`
- [x] Migración `0003_platform_admin_demo_telemetry` + admin Django
- [x] Seed packages: `pkg_instrumental`, `pkg_inventory`, `pkg_logistics`, `pkg_full`

### Fase 1 — Provisioning de demos (API + UI plataforma)

- [x] Permiso `IsPlatformAdmin` (superuser)
- [x] API list/create orgs demo, purge, extend, assign-package, packages, usage
- [x] Frontend `/platform` (crear demo, duración, package, purge, +7 días, gráficas uso)
- [ ] Seed dummy de negocio al provisionar (hoy activa módulos; falta data sample por package)
- [ ] Tests API (no purge de `customer`)

### Fase 2 — Caducidad + CTA ventas

- [x] Middleware `DemoExpiryMiddleware` + `demo_locked`
- [x] Pantalla “Demo finalizada” + `mailto:sales@init.com.mx`
- [x] Banner aviso ≤7 días en dashboard cliente
- [x] `GET /api/demo/request-license/` + `extend-demo`
- [ ] Celery beat para demos vencidas
- [ ] Bloqueo duro de APIs de negocio cuando `demo_expired` (hoy gate UI)

### Fase 3 — Telemetría y monitoreo

- [x] `UsageTelemetryMiddleware` en `/api/*` (IP, path, módulo)
- [x] Summary + top IPs por org en API platform
- [x] Gráficas uso en `/platform`
- [ ] IP en login view
- [ ] Job rollup diario
- [ ] UI detalle por cliente (IPs recientes en card)
- [ ] Tests aislamiento

### Fase 4 — Productos adaptables

- [x] Asignar package al crear / `assign-package`
- [ ] Consumir `OrganizationProduct.config` en frontend (feature flags / labels)
- [ ] Checklist doc de adaptación por cliente

### Fase 5 — Dashboard cliente con gráficas

- [x] `SimpleBarChart`
- [x] Distribución inventario por estado
- [x] Embudo instrumental por status
- [ ] Serie actividad 7 días en dashboard cliente

### Fase 6 — Hardening

- [x] Usuarios demo sin `is_staff`/`is_superuser`
- [x] `PlatformAuditLog` en provision/purge/extend/assign
- [ ] Rate limit + SMTP credenciales + E2E

---

## Flujo objetivo (ops INIT)

```
Platform admin
  → Crear cliente demo (Avant)
      · email contacto + duración (ej. 14 días)
      · packages: Control de instrumental (+ inventario)
      · seed dummy
  → Entregar credenciales
Cliente usa Panoptes
  → Telemetría (IP, módulos, volumen)
Demo vence
  → Pantalla bloqueo + mailto sales@init.com.mx
INIT
  → Extiende demo Ó convierte a customer + deja datos
  → O purge demo y limpia
```

---

## Modelo de datos (borrador)

```
Organization
  + account_type, demo_expires_at, demo_duration_days
  + contact_email, contact_name, notes, sales_owner

ProductPackage (code, name, description, is_public)
ProductPackageModule (package, module, sort_order)
OrganizationProduct (organization, package, is_active, config JSON, adapted_notes)

UsageEvent (organization, user?, path, method, status_code, ip, module_code?, ua, created)
UsageDailyRollup (organization, day, module_code, request_count, unique_users, unique_ips)

PlatformAuditLog (actor, action, organization?, payload JSON, created)
```

---

## Endpoints previstos

| Método | Ruta | Quién |
|--------|------|--------|
| GET/POST | `/api/platform/organizations/` | platform |
| GET/PATCH | `/api/platform/organizations/{id}/` | platform |
| POST | `/api/platform/organizations/{id}/provision-demo/` | platform |
| POST | `/api/platform/organizations/{id}/purge-demo/` | platform |
| POST | `/api/platform/organizations/{id}/extend-demo/` | platform |
| GET | `/api/platform/packages/` | platform |
| POST | `/api/platform/organizations/{id}/assign-package/` | platform |
| GET | `/api/platform/usage/summary/` | platform |
| GET | `/api/platform/usage/organizations/{id}/` | platform |
| GET | `/api/dashboard/charts/` | tenant (org del usuario) |
| POST | `/api/demo/request-license/` | demo expirada (público auth) |

---

## Criterios de aceptación (MVP)

1. Puedo crear desde `/platform` una org demo con email, duración y package instrumental.
2. El usuario demo entra, ve solo sus módulos, con datos dummy.
3. Puedo ver en plataforma qué módulos usa y desde qué IPs (al menos last login + eventos recientes).
4. Al vencer, no puede operar; ve CTA a `sales@init.com.mx`.
5. Puedo purgar la demo sin afectar otras orgs.
6. El dashboard inicial del cliente muestra ≥2 gráficas útiles (inventario + embudo instrumental si aplica).

---

## Orden de implementación inmediato

1. Modelos + migración + admin + seed packages  
2. `IsPlatformAdmin` + APIs provision/purge/list  
3. UI `/platform` mínima  
4. Middleware caducidad + pantalla CTA  
5. Telemetría básica + rollups  
6. Gráficas dashboard cliente  

---

## Fuera de alcance (por ahora)

- Billing / Stripe / facturación
- Self-serve signup público
- Multi-org switcher en sesión (sigue 1ª membership)
- App móvil nativa
- Drivers RFID reales

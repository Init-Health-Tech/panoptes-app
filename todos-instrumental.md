# Panoptes — Módulo Control de Instrumental Médico

> **App Django:** `instrumental`  
> **Código de módulo:** `instrumental_control`  
> **Estado:** Fase 1 completada — backend, API handheld RFID/SKU, UI demo y seed clínica.

---

## Objetivo

Gestionar el ciclo completo del instrumental y equipo médico para procedimientos: solicitud del doctor → cotización → aceptación → asignación a técnicos (con esterilización) → transporte en camioneta RFID → uso en hospital → retorno y validación en almacén.

**Identificación dual (demo):** cada ítem puede rastrearse por **tag RFID** (`inventory.RFIDTag`) o por **SKU ASCII** (equivalente legible del EPC) cuando no hay lector disponible.

---

## Flujo de negocio

```
Doctor agenda procedimiento
        │
        ▼
Solicita instrumental / equipo / charola (líneas de solicitud)
        │
        ▼
Coordinación genera COTIZACIÓN ──► Doctor ACEPTA / RECHAZA
        │
        ▼
Plan de cumplimiento: materiales → técnico, esterilización, camioneta
        │
        ▼
Handheld: carga salida almacén ──► llegada hospital ──► salida hospital ──► retorno almacén
        │
        ▼
Validación en almacén + inventario en tiempo real
        │
        ▼
(Opcional) Programación por cercanía → reutilizar material en siguiente procedimiento
```

---

## Modelos (Fase 1 — implementados)

| Modelo | Propósito |
|--------|-----------|
| `HospitalSite` | Hospitales + almacén central (`is_central`) |
| `InstrumentCatalogItem` | Catálogo instrumento/equipo/charola; `sku` + `rfid_tag` opcional |
| `TransportVehicle` | Camioneta con RFID opcional |
| `InstrumentProcedureRequest` | Solicitud ligada a `medical.Procedure` |
| `InstrumentRequestLine` | Líneas de lo solicitado |
| `InstrumentQuotation` | Cotización 1:1 con solicitud |
| `QuotationLine` | Detalle cotizado (precio, esterilización) |
| `FulfillmentPlan` | Plan post-aceptación (vehículo, técnico, tiempos) |
| `MaterialDispatch` | Material específico asignado (RFID o SKU, técnico, esterilización) |
| `HandheldScanEvent` | Eventos handheld (salida/llegada/retorno/validación) |
| `ProximityScheduleLink` | Encadenar procedimientos cercanos para reutilizar material |

---

## API (Fase 1)

| Endpoint | Descripción |
|----------|-------------|
| `CRUD /api/hospital-sites/` | Sedes hospitalarias |
| `CRUD /api/instrument-catalog/` | Catálogo SKU/RFID |
| `CRUD /api/transport-vehicles/` | Camionetas |
| `CRUD /api/instrument-procedure-requests/` | Solicitudes |
| `POST .../instrument-procedure-requests/{id}/create-quotation/` | Generar cotización |
| `POST .../instrument-procedure-requests/{id}/accept-quotation/` | Doctor acepta |
| `POST .../instrument-procedure-requests/{id}/plan-fulfillment/` | Crear plan + despachos |
| `CRUD /api/instrument-quotations/` | Cotizaciones (lectura/edición) |
| `CRUD /api/fulfillment-plans/` | Planes de cumplimiento |
| `CRUD /api/material-dispatches/` | Despachos de material |
| `POST /api/instrumental/handheld-scans/` | Escaneo RFID o SKU |
| `GET /api/instrumental/dashboard-stats/` | KPIs del módulo |

**Permiso:** `has_module_and_role("instrumental_control")`  
**Aceptar cotización:** roles `admin`, `doctor`

---

## Frontend (Fase 1)

- [x] `/instrumental-requests` — solicitudes + crear + acciones cotización
- [x] `/instrumental-quotations` — cotizaciones pendientes / aceptar
- [x] `/instrumental-fulfillment` — planes y despachos
- [x] `/instrumental-handheld` — demo escaneo salida/llegada/retorno
- [x] KPIs en dashboard
- [x] Sidebar sección «Instrumental médico»

---

## Fases siguientes

### Fase 2 — Operación avanzada
- [ ] Reglas de esterilización (cola, tiempos mínimos)
- [ ] Alertas si material no retorna a tiempo (`estimated_out_hours`)
- [ ] Vista calendario proximidad entre hospitales
- [ ] Integración webhook RFID existente → actualizar `MaterialDispatch` automáticamente

### Fase 3 — Handheld real
- [ ] API offline-friendly (batch scans)
- [ ] Autenticación por API key de org en handheld
- [ ] PWA móvil dedicada

### Fase 4 — Comercial
- [ ] PDF cotización
- [ ] Historial de costos por doctor/hospital
- [ ] Reportes de utilización de instrumental

---

## Criterios de verificación — Fase 1

```bash
make docker_makemigrations
make docker_migrate
docker compose exec backend python manage.py seed_modules
docker compose exec backend python manage.py seed_demo

make docker_test instrumental
make docker_backend_update_schema
make docker_frontend_update_api
pnpm run tsc && pnpm test
```

**Manual demo (`clinica@init.health`):**
1. Crear solicitud de instrumental para procedimiento existente
2. Generar cotización → aceptar como doctor
3. Planificar cumplimiento (técnico + camioneta + materiales RFID y SKU)
4. Handheld: escanear salida de almacén → llegada hospital → retorno → validación
5. Ver KPIs en dashboard y estado en inventario

---

## Convenciones

- Heredar `OrganizationModel` en todos los modelos de negocio
- `OrganizationViewSetMixin` en ViewSets
- SKU único por organización; si hay `rfid_tag`, `sku` puede igualar `tag.code` para demo
- No modificar login/auth base del boilerplate

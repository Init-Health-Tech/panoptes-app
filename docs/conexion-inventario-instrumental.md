# Conexión Inventario ↔ Instrumental ↔ Cargas

> **Estado:** implementado (custodia + UX stepper/tours spotlight/nav reducida)  
> **Objetivo:** que un tag RFID sea una unidad física única: al cargarse en un envío/despacho cambie de estado y **no pueda cargarse en otro lado** al mismo tiempo.

---

## 1. El problema hoy

Hoy hay **tres mundos** que tocan RFID pero no se coordinan:

| Módulo | Qué hace con el tag | ¿Cambia estado del tag? | ¿Impide doble uso? |
|--------|---------------------|-------------------------|--------------------|
| **Inventario** (`RFIDTag`) | Registro físico + lecturas webhook/CRUD | Sí (manual o webhook) | No |
| **Instrumental comercial** (`MaterialDispatch`) | Copia el tag del catálogo al despacho | Solo en handheld | **No** |
| **Cargas / envíos clínicos** (`SupplyKit` + `SupplyKitTag`) | Asocia tags a la maleta/instrumental | **Nunca** | **No** |

Consecuencia práctica:

- Puedes meter el mismo RFID en dos maletas.
- Puedes crear un despacho instrumental con un tag que ya va en una carga clínica.
- La maleta puede estar `en_transito` y el tag seguir `en_stock`.
- El webhook de inventario puede pisar el estado sin mirar si el tag está “ocupado”.

Por eso se sienten módulos separados: **comparten el código EPC, pero no la custodia**.

---

## 2. Idea central: custodia exclusiva

Tratar `RFIDTag` como el **activo físico**.

Tratar maleta (`SupplyKit`) y despacho (`MaterialDispatch`) como **custodias temporales** (un trabajo / un viaje).

### Regla de oro

> Un tag solo puede tener **una custodia abierta** a la vez.

Es decir, como máximo una de estas:

1. Pertenecer a una **carga clínica abierta** (`SupplyKit` en `armando | lista | en_transito | entregada | retornando`), **o**
2. Estar asignado a un **despacho instrumental abierto** (`MaterialDispatch` con status ≠ `validated`),

…pero **nunca las dos**, ni dos de la misma clase.

Cuando la custodia se cierra (almacén confirma / valida el retorno), el tag vuelve a quedar **libre** y `en_stock`.

```
                    ┌─────────────────────┐
                    │     RFIDTag         │
                    │  (unidad física)    │
                    └─────────┬───────────┘
                              │
              ┌───────────────┴───────────────┐
              │     ¿Tiene custodia abierta?  │
              └───────────────┬───────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     Libre (en_stock)   Carga clínica     Despacho instrumental
                        (SupplyKit)       (MaterialDispatch)
                              │                 │
                              └────────┬────────┘
                                       ▼
                         Transiciones sincronizan
                         status del RFIDTag
```

---

## 3. Cómo se conectan los módulos

### 3.1 Inventario = fuente de verdad del físico

`inventory.RFIDTag` sigue siendo:

- código único por organización
- estado operativo: `en_stock | en_transito | en_uso | dado_de_baja`
- última ubicación / última lectura

Todo lo demás **pide prestado** el tag; no crea otra “copia” del activo.

### 3.2 Catálogo instrumental = identidad comercial (opcional)

`InstrumentCatalogItem.rfid_tag`:

- dice “este SKU trackeable es esta unidad física”
- **no** significa que el tag ya esté cargado
- al generar cotización **no** se reserva RFID (sigue siendo comercial)

La reserva física ocurre más tarde: al **armar / planificar / cargar**.

### 3.3 Cargas clínicas (`/supply-kits`) = custodia tipo “maleta”

Flujo ya existente, pero con sync a inventario:

| Paso carga | Estado kit | Estado RFID propuesto |
|------------|------------|------------------------|
| Asignar tag | `armando` / `lista` | tag pasa a custodia; si estaba libre → se marca ocupado (ver §4) |
| Enviar (transportista + técnico) | `en_transito` | `en_transito` |
| Confirmar hospital | `entregada` | `en_uso` |
| Checklist regreso | `retornando` | `en_transito` |
| Confirmar almacén | `devuelta` | `en_stock` + **libera custodia** |

### 3.4 Instrumental operativo (`fulfillment` + handheld) = custodia tipo “despacho”

| Paso instrumental | Estado despacho | Estado RFID propuesto |
|-------------------|-----------------|------------------------|
| `plan-fulfillment` | `assigned` | reserva custodia (tag debe estar libre / `en_stock`) |
| Handheld salida de almacén | `loaded` | `en_transito` |
| Llegada hospital | `at_hospital` | `en_uso` |
| Salida hospital / retorno | `returning` / `returned` | `en_transito` |
| Validación en almacén | `validated` | `en_stock` + **libera custodia** |

---

## 4. Política de “no se puede cargar en otro lado”

### 4.1 Qué bloquea

Al intentar:

- `POST /supply-kits/{id}/add-tags/`
- `POST .../plan-fulfillment/` (cuando copia `catalog.rfid_tag`)
- (futuro) “cargar / escanear salida” si se separa de la reserva

…el backend debe rechazar si el tag:

1. Ya está en **otra carga abierta**, o
2. Ya está en **otro despacho abierto**, o
3. Está `dado_de_baja`, o
4. (opcional estricto) no está `en_stock` cuando se quiere iniciar custodia.

Respuesta esperada (ejemplo):

```json
{
  "detail": "El tag EPC-DEMO-EQ-01 ya está en custodia.",
  "custody": {
    "type": "supply_kit",
    "id": 12,
    "code": "MK-INI-01",
    "status": "en_transito"
  }
}
```

o `"type": "material_dispatch"` con su request/fulfillment.

### 4.2 Qué sí se permite

- Mismo tag en historial de kits/despachos **cerrados**.
- Lecturas webhook mientras está en custodia (actualizan ubicación; no abren otra custodia).
- Cotizar sin RFID (líneas de catálogo).

### 4.3 Momento exacto de la reserva

Propuesta concreta:

| Acción | ¿Reserva? |
|--------|-----------|
| Crear cotización | No |
| Aceptar cotización | No |
| Asignar tag a maleta (`add-tags`) | **Sí** |
| `plan-fulfillment` (si el catálogo trae RFID) | **Sí** |
| Handheld `load_departure` | Confirma tránsito (ya debería estar reservado) |

Así “cargar” = entrar en custodia, no solo dibujar el tag en una lista.

---

## 5. Quién puede escribir el `status` del RFID

Hoy escriben tres: CRUD inventario, webhook, handheld. Eso genera inconsistencias.

Propuesta:

| Escritor | Puede cambiar `status`? | Rol |
|----------|-------------------------|-----|
| Transiciones de **carga clínica** | Sí | Dueño cuando custodia = kit |
| Transiciones de **handheld / despacho** | Sí | Dueño cuando custodia = despacho |
| Webhook RFID | Preferible **no** pisar status si hay custodia; sí `last_location` / `last_read_at` | Evidencia de lectura |
| CRUD inventario | Solo si tag **libre**; o roles admin con override auditado | Corrección manual |

Regla simple para UI:

- Si el tag está en custodia, el inventario lo muestra como **ocupado** (con link al kit o al despacho).
- No ofreces “meterlo en otra maleta” ni “asignarlo a otro fulfillment”.

---

## 6. Vista mental unificada (para producto)

```
Inventario
  └── RFIDTag (físico, estado, ubicación)
         │
         ├── [libre] disponible para cargar
         │
         ├── custodia A: SupplyKit (carga clínica)
         │      armando → tránsito → hospital → regreso → almacén
         │
         └── custodia B: MaterialDispatch (instrumental)
                assigned → loaded → hospital → retorno → validado en almacén

Comercial (cotización/contratos)
  └── no custodia RFID; solo precios por doctor/hospital
```

Los módulos siguen existiendo (comercial ≠ operativo ≠ clínico), pero **comparten la misma exclusividad sobre el tag**.

---

## 7. Cambios técnicos previstos (implementación posterior)

Sin implementar aún; checklist de ingeniería:

1. **Servicio de custodia** (ej. `inventory.services.custody`):
   - `get_open_custody(tag) -> kit | dispatch | None`
   - `assert_tag_available(tag)`
   - `sync_tag_status(tag, event)`
2. **Hooks en**:
   - `SupplyKitViewSet.add_tags` / `assign_dispatch` / hospital / checklist / warehouse
   - `plan_fulfillment` y `process_handheld_scan`
3. **Validaciones**:
   - rechazo 400 con detalle de custodia actual
   - tests: mismo tag en dos kits; kit + despacho; liberación al cerrar
4. **API inventario**:
   - campos read-only `custody_type`, `custody_id`, `custody_label`
5. **UI**:
   - al elegir tag en maleta/despacho, filtrar solo libres / `en_stock`
   - badge “En uso en MK-…” o “En despacho REQ-…”

Opcional fase 2:

- constraint parcial en DB (más duro que validar solo en app)
- webhook que valide “lectura esperada según custodia”
- unificar checklist de regreso clínico con scans RFID reales

---

## 8. Criterios de aceptación

- [x] No puedo agregar a una maleta un RFID que ya está en otra maleta abierta.
- [x] No puedo planear fulfillment con un RFID que ya está en una maleta abierta.
- [x] Al enviar maleta, el tag pasa a `en_transito`.
- [x] Al confirmar hospital (maleta o handheld), el tag pasa a `en_uso`.
- [x] Al confirmar / validar en almacén, el tag vuelve a `en_stock` y queda libre.
- [x] El inventario muestra dónde está ocupado el tag.
- [x] Cotizar no reserva RFID.

---

## 9. Resumen en una frase

**Inventario es el físico; instrumental comercial cotiza; cargas clínicas y despachos operativos son las únicas custodias; una custodia abierta por tag; cada transición de viaje sincroniza el estado RFID y bloquea que ese tag se cargue en otro lado.**

---

## 10. UX unificada (implementado)

### Un solo producto: Control de instrumental
Clínico e Instrumental médico se unifican en la sección **Control de instrumental**:

- **Flujo** (`/instrumental`) — solicitud → cotización → despacho → hospital → almacén
- **Cargas RFID** (`/supply-kits`) — armado clínico con custodia de tags
- **Contratos**, **Procedimientos**, **Doctores**, **Técnicos**

El flag de producto `instrumental_control` desbloquea la nav y las APIs médicas asociadas; los códigos `medical_*` siguen existiendo a nivel de datos/permisos finos.

### Stepper por caso
Cada carga / cada REQ muestra: completado → en proceso → pendiente. El rol limita las acciones del paso actual.

### Tutoriales
`GuidedTour` por pantalla (spotlight + overlay oscuro; auto en la primera visita; botón `?` para repetir).

### Atomic design
- Átomos: `CustodyBadge`, logo, inputs.
- Moléculas: `ProcessStepper`, `GuidedTour`, `RfidScanHint`.
- Páginas: `SupplyKits`, `InstrumentalFlow`, `Inventory`.

### Código clave
- `backend/inventory/custody.py`
- Sync en vistas médicas + `plan-fulfillment` + handheld
- Webhook no pisa `status` si hay custodia abierta

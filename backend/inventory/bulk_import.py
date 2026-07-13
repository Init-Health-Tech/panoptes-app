from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction

from common.excel_io import build_template, cell_bool, cell_str, read_sheet_rows
from instrumental.models import CatalogItemType, InstrumentCatalogItem
from inventory.models import InventoryLocation, InventoryLocationType, RFIDTag, RFIDTagStatus
from inventory.rfid_code import RfidCodeError, normalize_rfid_code, rfid_code_variants

CATALOG_HEADERS = [
    "sku",
    "name",
    "item_type",
    "category",
    "brand",
    "unit",
    "default_unit_price",
    "requires_sterilization",
    "description",
    "is_active",
]

INVENTORY_HEADERS = [
    "code",
    "catalog_sku",
    "item_type",
    "location_code",
    "last_location",
    "status",
    "lot",
    "expires_on",
]

LOCATION_HEADERS = [
    "code",
    "name",
    "location_type",
    "is_active",
]

ITEM_TYPE_VALUES = {c.value for c in CatalogItemType}
STATUS_VALUES = {c.value for c in RFIDTagStatus}
LOCATION_TYPE_VALUES = {c.value for c in InventoryLocationType}

MAX_ROWS = 2000


def catalog_template():
    return build_template(
        sheet_title="Catalogo",
        headers=CATALOG_HEADERS,
        example_row=[
            "SKU-MON-01",
            "Monitor hemodinámico",
            "equipment",
            "Cardiología",
            "Philips",
            "pza",
            "520.00",
            "no",
            "Equipo demo",
            "si",
        ],
        dropdowns={
            "item_type": sorted(ITEM_TYPE_VALUES),
            "requires_sterilization": ["si", "no"],
            "is_active": ["si", "no"],
        },
        notes=[
            "No elimines la fila de encabezados.",
            "sku y name son obligatorios. item_type: instrument | equipment | tray | consumable.",
            "Filas con SKU ya existente en la organización se omiten (duplicado).",
            "SKUs duplicados dentro del mismo archivo: solo se importa el primero; el resto se reporta.",
            f"Máximo {MAX_ROWS} filas de datos por archivo.",
        ],
    )


def inventory_template():
    return build_template(
        sheet_title="Inventario",
        headers=INVENTORY_HEADERS,
        example_row=[
            "4142434445464748494A4B4C",
            "SKU-MON-01",
            "",
            "LOC-CENTRAL",
            "",
            "en_stock",
            "Lote-A1",
            "2027-12-31",
        ],
        dropdowns={
            "status": sorted(STATUS_VALUES),
        },
        notes=[
            "code (EPC RFID) es obligatorio: 24 hex o ASCII hasta 12 chars (se rellena con espacios 0x20).",
            "Ejemplo hex: 4142434445464748494A4B4C (ASCII: ABCDEFGHIJKL)",
            "Ejemplo ASCII corto: ABC → EPC 414243202020202020202020",
            "catalog_sku opcional: debe existir en el catálogo. Si se indica, item_type se toma del producto.",
            "location_code opcional: código de Ubicaciones de inventario.",
            "lot y expires_on (AAAA-MM-DD) son opcionales.",
            "Códigos RFID duplicados (archivo o BD) se omiten.",
            f"Máximo {MAX_ROWS} filas de datos por archivo.",
        ],
    )


def location_template():
    return build_template(
        sheet_title="Ubicaciones",
        headers=LOCATION_HEADERS,
        example_row=["LOC-CENTRAL", "Almacén central", "warehouse", "si"],
        dropdowns={
            "location_type": sorted(LOCATION_TYPE_VALUES),
            "is_active": ["si", "no"],
        },
        notes=[
            "code y name son obligatorios. code único por organización.",
            "location_type: warehouse | zone | hospital | vehicle | other.",
            f"Máximo {MAX_ROWS} filas de datos por archivo.",
        ],
    )


def _parse_expires_on(raw) -> date | None:
    if raw is None or raw == "":
        return None
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    text = str(raw).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Fecha inválida «{text}». Use AAAA-MM-DD.")


def _too_many_rows(rows: list) -> list[dict] | None:
    if len(rows) > MAX_ROWS:
        return [
            {
                "row": 0,
                "field": "file",
                "message": f"El archivo tiene {len(rows)} filas; el máximo es {MAX_ROWS}.",
            }
        ]
    return None


@transaction.atomic
def import_catalog_items(organization, uploaded_file) -> dict:
    _, rows, parse_errors = read_sheet_rows(uploaded_file, expected_headers=["sku", "name", "item_type"])
    if parse_errors:
        return {"created": 0, "skipped": 0, "errors": parse_errors, "created_items": []}
    if limit_err := _too_many_rows(rows):
        return {"created": 0, "skipped": 0, "errors": limit_err, "created_items": []}

    existing = set(
        InstrumentCatalogItem.objects.filter(organization=organization).values_list("sku", flat=True)
    )
    seen_in_file: set[str] = set()
    created = 0
    skipped = 0
    errors: list[dict] = []
    created_items: list[dict] = []

    for row in rows:
        excel_row = row["_row"]
        sku = cell_str(row, "sku")
        name = cell_str(row, "name")
        item_type = cell_str(row, "item_type").lower()

        if not sku or not name:
            errors.append(
                {"row": excel_row, "field": "sku/name", "message": "sku y name son obligatorios."}
            )
            skipped += 1
            continue
        if item_type not in ITEM_TYPE_VALUES:
            errors.append(
                {
                    "row": excel_row,
                    "field": "item_type",
                    "message": f"item_type inválido «{item_type}». Use: {', '.join(sorted(ITEM_TYPE_VALUES))}.",
                }
            )
            skipped += 1
            continue
        if sku in seen_in_file:
            errors.append(
                {"row": excel_row, "field": "sku", "message": f"SKU duplicado en el archivo: {sku}."}
            )
            skipped += 1
            continue
        if sku in existing:
            errors.append(
                {"row": excel_row, "field": "sku", "message": f"SKU ya existe en el catálogo: {sku}."}
            )
            skipped += 1
            continue

        seen_in_file.add(sku)
        price_raw = cell_str(row, "default_unit_price")
        price = None
        if price_raw:
            try:
                price = Decimal(price_raw)
            except (InvalidOperation, ValueError):
                errors.append(
                    {
                        "row": excel_row,
                        "field": "default_unit_price",
                        "message": f"Precio inválido: {price_raw}.",
                    }
                )
                skipped += 1
                continue

        item = InstrumentCatalogItem.objects.create(
            organization=organization,
            sku=sku,
            name=name,
            item_type=item_type,
            category=cell_str(row, "category"),
            brand=cell_str(row, "brand"),
            unit=cell_str(row, "unit") or "pza",
            default_unit_price=price,
            requires_sterilization=cell_bool(row, "requires_sterilization", False),
            description=cell_str(row, "description"),
            is_active=cell_bool(row, "is_active", True),
        )
        existing.add(sku)
        created += 1
        created_items.append({"id": item.id, "sku": item.sku, "name": item.name})

    return {
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "created_items": created_items,
    }


@transaction.atomic
def import_inventory_tags(organization, uploaded_file) -> dict:
    _, rows, parse_errors = read_sheet_rows(uploaded_file, expected_headers=["code"])
    if parse_errors:
        return {"created": 0, "skipped": 0, "errors": parse_errors}
    if limit_err := _too_many_rows(rows):
        return {"created": 0, "skipped": 0, "errors": limit_err}

    existing_codes = set(
        RFIDTag.objects.filter(organization=organization).values_list("code", flat=True)
    )
    # Expand with ASCII equivalents for duplicate detection
    for code in list(existing_codes):
        for variant in rfid_code_variants(code):
            existing_codes.add(variant)
    catalog_by_sku = {
        item.sku: item
        for item in InstrumentCatalogItem.objects.filter(organization=organization, is_active=True)
    }
    locations_by_code = {
        loc.code: loc
        for loc in InventoryLocation.objects.filter(organization=organization, is_active=True)
    }

    seen_in_file: set[str] = set()
    created = 0
    skipped = 0
    errors: list[dict] = []

    for row in rows:
        excel_row = row["_row"]
        raw_code = cell_str(row, "code")
        if not raw_code:
            errors.append({"row": excel_row, "field": "code", "message": "code es obligatorio."})
            skipped += 1
            continue

        try:
            store_code = normalize_rfid_code(raw_code, strict=True)
        except RfidCodeError as exc:
            errors.append({"row": excel_row, "field": "code", "message": str(exc)})
            skipped += 1
            continue

        lookup_variants = set(rfid_code_variants(store_code))
        if lookup_variants & seen_in_file:
            errors.append(
                {
                    "row": excel_row,
                    "field": "code",
                    "message": f"Código RFID duplicado en el archivo: {raw_code}.",
                }
            )
            skipped += 1
            continue
        if lookup_variants & existing_codes:
            errors.append(
                {
                    "row": excel_row,
                    "field": "code",
                    "message": f"Código RFID ya existe (hex o ASCII): {raw_code}.",
                }
            )
            skipped += 1
            continue

        catalog_sku = cell_str(row, "catalog_sku")
        catalog_item = None
        item_type = cell_str(row, "item_type")
        if catalog_sku:
            catalog_item = catalog_by_sku.get(catalog_sku)
            if catalog_item is None:
                errors.append(
                    {
                        "row": excel_row,
                        "field": "catalog_sku",
                        "message": f"SKU de catálogo no encontrado: {catalog_sku}.",
                    }
                )
                skipped += 1
                continue
            item_type = catalog_item.name

        location_code = cell_str(row, "location_code")
        inventory_location = None
        last_location = cell_str(row, "last_location")
        if location_code:
            inventory_location = locations_by_code.get(location_code)
            if inventory_location is None:
                errors.append(
                    {
                        "row": excel_row,
                        "field": "location_code",
                        "message": f"Ubicación no encontrada: {location_code}.",
                    }
                )
                skipped += 1
                continue
            last_location = inventory_location.name

        status_value = cell_str(row, "status") or RFIDTagStatus.EN_STOCK
        if status_value not in STATUS_VALUES:
            errors.append(
                {
                    "row": excel_row,
                    "field": "status",
                    "message": f"status inválido «{status_value}». Use: {', '.join(sorted(STATUS_VALUES))}.",
                }
            )
            skipped += 1
            continue

        lot = cell_str(row, "lot")
        try:
            expires_on = _parse_expires_on(row.get("expires_on"))
        except ValueError as exc:
            errors.append({"row": excel_row, "field": "expires_on", "message": str(exc)})
            skipped += 1
            continue

        seen_in_file.update(lookup_variants)
        tag = RFIDTag(
            organization=organization,
            code=store_code,
            catalog_item=catalog_item,
            item_type=item_type,
            inventory_location=inventory_location,
            last_location=last_location,
            status=status_value,
            lot=lot,
            expires_on=expires_on,
        )
        tag.sync_denormalized_fields()
        tag.save()
        existing_codes.update(lookup_variants)
        created += 1

    return {"created": created, "skipped": skipped, "errors": errors}


@transaction.atomic
def import_inventory_locations(organization, uploaded_file) -> dict:
    _, rows, parse_errors = read_sheet_rows(uploaded_file, expected_headers=["code", "name"])
    if parse_errors:
        return {"created": 0, "skipped": 0, "errors": parse_errors}
    if limit_err := _too_many_rows(rows):
        return {"created": 0, "skipped": 0, "errors": limit_err}

    existing = set(
        InventoryLocation.objects.filter(organization=organization).values_list("code", flat=True)
    )
    seen_in_file: set[str] = set()
    created = 0
    skipped = 0
    errors: list[dict] = []

    for row in rows:
        excel_row = row["_row"]
        code = cell_str(row, "code")
        name = cell_str(row, "name")
        location_type = cell_str(row, "location_type") or InventoryLocationType.WAREHOUSE

        if not code or not name:
            errors.append(
                {"row": excel_row, "field": "code/name", "message": "code y name son obligatorios."}
            )
            skipped += 1
            continue
        if location_type not in LOCATION_TYPE_VALUES:
            errors.append(
                {
                    "row": excel_row,
                    "field": "location_type",
                    "message": f"location_type inválido «{location_type}».",
                }
            )
            skipped += 1
            continue
        if code in seen_in_file or code in existing:
            errors.append(
                {
                    "row": excel_row,
                    "field": "code",
                    "message": f"Código de ubicación duplicado: {code}.",
                }
            )
            skipped += 1
            continue

        seen_in_file.add(code)
        InventoryLocation.objects.create(
            organization=organization,
            code=code,
            name=name,
            location_type=location_type,
            is_active=cell_bool(row, "is_active", True),
        )
        existing.add(code)
        created += 1

    return {"created": created, "skipped": skipped, "errors": errors}

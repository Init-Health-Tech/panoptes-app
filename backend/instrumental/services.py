from decimal import Decimal

from django.utils import timezone

from inventory.models import RFIDTag, RFIDTagStatus
from instrumental.models import (
    DispatchStatus,
    FulfillmentStatus,
    HandheldEventType,
    HandheldScanEvent,
    InstrumentCatalogItem,
    MaterialDispatch,
    RequestStatus,
    SterilizationStatus,
)


def resolve_identifier(organization, identifier: str):
    """Resolve a scan identifier to RFID tag, catalog SKU, or active dispatch."""
    identifier = (identifier or "").strip()
    if not identifier:
        return None, None, None

    tag = RFIDTag.objects.filter(organization=organization, code=identifier).first()
    if tag:
        dispatch = (
            MaterialDispatch.objects.filter(organization=organization, rfid_tag=tag)
            .exclude(status=DispatchStatus.VALIDATED)
            .order_by("-created")
            .first()
        )
        return tag, None, dispatch

    catalog = InstrumentCatalogItem.objects.filter(
        organization=organization,
        sku=identifier,
        is_active=True,
    ).first()
    if catalog:
        dispatch = (
            MaterialDispatch.objects.filter(organization=organization, sku=identifier)
            .exclude(status=DispatchStatus.VALIDATED)
            .order_by("-created")
            .first()
        )
        if not dispatch and catalog.rfid_tag_id:
            dispatch = (
                MaterialDispatch.objects.filter(
                    organization=organization,
                    rfid_tag=catalog.rfid_tag,
                )
                .exclude(status=DispatchStatus.VALIDATED)
                .order_by("-created")
                .first()
            )
        return catalog.rfid_tag, catalog, dispatch

    dispatch = (
        MaterialDispatch.objects.filter(organization=organization, sku=identifier)
        .exclude(status=DispatchStatus.VALIDATED)
        .order_by("-created")
        .first()
    )
    return None, None, dispatch


_DISPATCH_STATUS_BY_EVENT = {
    HandheldEventType.LOAD_DEPARTURE: DispatchStatus.LOADED,
    HandheldEventType.HOSPITAL_ARRIVAL: DispatchStatus.AT_HOSPITAL,
    HandheldEventType.HOSPITAL_DEPARTURE: DispatchStatus.RETURNING,
    HandheldEventType.RETURN_ARRIVAL: DispatchStatus.RETURNED,
    HandheldEventType.CRCAO_VALIDATION: DispatchStatus.VALIDATED,
}

_RFID_STATUS_BY_EVENT = {
    HandheldEventType.LOAD_DEPARTURE: RFIDTagStatus.EN_TRANSITO,
    HandheldEventType.HOSPITAL_ARRIVAL: RFIDTagStatus.EN_USO,
    HandheldEventType.HOSPITAL_DEPARTURE: RFIDTagStatus.EN_TRANSITO,
    HandheldEventType.RETURN_ARRIVAL: RFIDTagStatus.EN_TRANSITO,
    HandheldEventType.CRCAO_VALIDATION: RFIDTagStatus.EN_STOCK,
}

_FULFILLMENT_STATUS_BY_EVENT = {
    HandheldEventType.LOAD_DEPARTURE: FulfillmentStatus.DISPATCHED,
    HandheldEventType.HOSPITAL_ARRIVAL: FulfillmentStatus.AT_HOSPITAL,
    HandheldEventType.HOSPITAL_DEPARTURE: FulfillmentStatus.RETURNING,
    HandheldEventType.RETURN_ARRIVAL: FulfillmentStatus.RETURNING,
    HandheldEventType.CRCAO_VALIDATION: FulfillmentStatus.VALIDATED,
}


def process_handheld_scan(organization, *, identifier, event_type, hospital=None, handheld_id="", location_notes=""):
    tag, catalog, dispatch = resolve_identifier(organization, identifier)
    if dispatch is None and catalog is not None:
        raise ValueError("No active material dispatch found for this identifier.")

    if dispatch is None and tag is not None:
        raise ValueError("No active material dispatch found for this RFID tag.")

    if dispatch is None:
        raise ValueError("Identifier not recognized for instrumental control.")

    new_dispatch_status = _DISPATCH_STATUS_BY_EVENT.get(event_type)
    if new_dispatch_status:
        dispatch.status = new_dispatch_status
        if event_type == HandheldEventType.HOSPITAL_ARRIVAL and hospital:
            dispatch.current_hospital = hospital
        if event_type in (HandheldEventType.LOAD_DEPARTURE, HandheldEventType.HOSPITAL_ARRIVAL):
            dispatch.loaded_at = dispatch.loaded_at or timezone.now()
        if event_type == HandheldEventType.CRCAO_VALIDATION:
            dispatch.returned_at = timezone.now()
        dispatch.save()

    rfid = dispatch.rfid_tag or tag
    if rfid and event_type in _RFID_STATUS_BY_EVENT:
        rfid.status = _RFID_STATUS_BY_EVENT[event_type]
        if hospital:
            rfid.last_location = hospital.name
        elif location_notes:
            rfid.last_location = location_notes
        rfid.save(update_fields=["status", "last_location", "modified"])

    fulfillment = dispatch.fulfillment
    if event_type in _FULFILLMENT_STATUS_BY_EVENT:
        fulfillment.status = _FULFILLMENT_STATUS_BY_EVENT[event_type]
        fulfillment.save(update_fields=["status", "modified"])

    request = fulfillment.request
    if event_type == HandheldEventType.LOAD_DEPARTURE:
        request.status = RequestStatus.IN_FIELD
    elif event_type == HandheldEventType.HOSPITAL_DEPARTURE:
        request.status = RequestStatus.RETURNING
    elif event_type == HandheldEventType.CRCAO_VALIDATION:
        request.status = RequestStatus.VALIDATED
    request.save(update_fields=["status", "modified"])

    scan = HandheldScanEvent.objects.create(
        organization=organization,
        material_dispatch=dispatch,
        rfid_tag=rfid,
        sku=dispatch.sku or (catalog.sku if catalog else ""),
        identifier_used=identifier,
        event_type=event_type,
        hospital=hospital,
        handheld_id=handheld_id,
        location_notes=location_notes,
    )
    return scan, dispatch


def unload_material_dispatch(dispatch: MaterialDispatch):
    """Remove a unit from the current load (loaded → assigned) and free RFID if any."""
    if dispatch.status not in (DispatchStatus.LOADED, DispatchStatus.IN_TRANSIT):
        raise ValueError("Solo se puede quitar material que aún esté en carga / tránsito de salida.")

    dispatch.status = DispatchStatus.ASSIGNED
    dispatch.loaded_at = None
    dispatch.save(update_fields=["status", "loaded_at", "modified"])

    if dispatch.rfid_tag_id:
        tag = dispatch.rfid_tag
        tag.status = RFIDTagStatus.EN_STOCK
        tag.save(update_fields=["status", "modified"])

    fulfillment = dispatch.fulfillment
    still_loaded = fulfillment.dispatches.exclude(
        status__in=[DispatchStatus.ASSIGNED, DispatchStatus.STERILIZING],
    ).exists()

    if not still_loaded:
        fulfillment.status = FulfillmentStatus.READY
        fulfillment.save(update_fields=["status", "modified"])
        request = fulfillment.request
        if request.status in (RequestStatus.IN_FIELD, RequestStatus.FULFILLMENT):
            request.status = RequestStatus.FULFILLMENT
            request.save(update_fields=["status", "modified"])

    return dispatch


DEFAULT_PRICES_BY_TYPE = {
    "instrument": Decimal("150.00"),
    "tray": Decimal("250.00"),
    "equipment": Decimal("500.00"),
}


def resolve_catalog_unit_price(organization, catalog_item, *, doctor=None, hospital=None, on_date=None):
    """
    Resolve unit price with precedence:
    doctor+hospital contract → doctor-only → hospital-only → catalog default → type default.

    Returns (unit_price, price_source, contract_or_none).
    """
    from django.db.models import Q

    from instrumental.models import InstrumentContractLine, InstrumentPriceContract

    doctor_id = getattr(doctor, "id", doctor)
    hospital_id = getattr(hospital, "id", hospital)
    today = on_date or timezone.localdate()

    qs = InstrumentPriceContract.objects.filter(organization=organization, is_active=True).filter(
        Q(valid_from__isnull=True) | Q(valid_from__lte=today),
    ).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=today),
    )

    candidates = []
    if doctor_id and hospital_id:
        candidates.append(("doctor_hospital", qs.filter(doctor_id=doctor_id, hospital_id=hospital_id)))
    if doctor_id:
        candidates.append(("doctor", qs.filter(doctor_id=doctor_id, hospital__isnull=True)))
    if hospital_id:
        candidates.append(("hospital", qs.filter(doctor__isnull=True, hospital_id=hospital_id)))

    for source, contract_qs in candidates:
        for contract in contract_qs:
            line = InstrumentContractLine.objects.filter(
                contract=contract,
                catalog_item=catalog_item,
            ).first()
            if line:
                return line.unit_price, source, contract

    if catalog_item.default_unit_price is not None:
        return catalog_item.default_unit_price, "catalog", None

    fallback = DEFAULT_PRICES_BY_TYPE.get(catalog_item.item_type, Decimal("150.00"))
    return fallback, "default", None

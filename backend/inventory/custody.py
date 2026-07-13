"""Exclusive RFID custody across clinical kits and instrumental dispatches."""

from __future__ import annotations

from dataclasses import asdict, dataclass

from inventory.models import RFIDTag, RFIDTagStatus


OPEN_KIT_STATUSES = (
    "armando",
    "lista",
    "en_transito",
    "entregada",
    "retornando",
)

# Dispatches remain open until warehouse validation closes the trip.
CLOSED_DISPATCH_STATUSES = ("validated",)


class CustodyError(Exception):
    """Raised when a tag cannot enter or leave custody as requested."""

    def __init__(self, message: str, custody: dict | None = None):
        super().__init__(message)
        self.message = message
        self.custody = custody or {}

    def as_response_data(self):
        payload = {"detail": self.message}
        if self.custody:
            payload["custody"] = self.custody
        return payload


@dataclass
class CustodyInfo:
    type: str  # supply_kit | material_dispatch
    id: int
    label: str
    status: str

    def to_dict(self):
        return asdict(self)


def get_open_custody(tag: RFIDTag, *, exclude_kit_id=None, exclude_dispatch_id=None) -> CustodyInfo | None:
    """Return the current open custody for a tag, if any."""
    from instrumental.models import MaterialDispatch
    from medical.models import SupplyKit

    kit_qs = SupplyKit.objects.filter(
        organization_id=tag.organization_id,
        tags=tag,
        status__in=OPEN_KIT_STATUSES,
    )
    if exclude_kit_id:
        kit_qs = kit_qs.exclude(pk=exclude_kit_id)
    kit = kit_qs.order_by("-modified").first()
    if kit:
        return CustodyInfo(
            type="supply_kit",
            id=kit.id,
            label=f"{kit.code} — {kit.name}",
            status=kit.status,
        )

    dispatch_qs = MaterialDispatch.objects.filter(
        organization_id=tag.organization_id,
        rfid_tag=tag,
    ).exclude(status__in=CLOSED_DISPATCH_STATUSES)
    if exclude_dispatch_id:
        dispatch_qs = dispatch_qs.exclude(pk=exclude_dispatch_id)
    dispatch = dispatch_qs.select_related("fulfillment__request").order_by("-created").first()
    if dispatch:
        req = getattr(dispatch.fulfillment, "request", None)
        label = f"Despacho #{dispatch.id}"
        if req:
            label = f"REQ-{req.id} · {dispatch.sku or tag.code}"
        return CustodyInfo(
            type="material_dispatch",
            id=dispatch.id,
            label=label,
            status=dispatch.status,
        )
    return None


def assert_tag_available(tag: RFIDTag, *, exclude_kit_id=None, exclude_dispatch_id=None) -> None:
    if tag.status == RFIDTagStatus.DADO_DE_BAJA:
        raise CustodyError(f"El tag {tag.code} está dado de baja.")
    custody = get_open_custody(
        tag,
        exclude_kit_id=exclude_kit_id,
        exclude_dispatch_id=exclude_dispatch_id,
    )
    if custody:
        raise CustodyError(
            f"El tag {tag.code} ya está en custodia.",
            custody=custody.to_dict(),
        )


def assert_tags_available(tags, *, exclude_kit_id=None, exclude_dispatch_id=None) -> None:
    for tag in tags:
        assert_tag_available(
            tag,
            exclude_kit_id=exclude_kit_id,
            exclude_dispatch_id=exclude_dispatch_id,
        )


def sync_kit_tags_status(supply_kit, *, status: str, location: str = "") -> int:
    """Update all RFID tags currently on a kit to the given inventory status."""
    updated = 0
    for tag in supply_kit.tags.all():
        tag.status = status
        fields = ["status", "modified"]
        if location:
            tag.last_location = location
            fields.append("last_location")
        tag.save(update_fields=fields)
        updated += 1
    return updated


def sync_dispatch_tag_status(dispatch, *, status: str, location: str = "") -> None:
    tag = dispatch.rfid_tag
    if not tag:
        return
    tag.status = status
    fields = ["status", "modified"]
    if location:
        tag.last_location = location
        fields.append("last_location")
    tag.save(update_fields=fields)


def available_tags_queryset(organization):
    """Tags free for loading: not decommissioned and without open custody."""
    from instrumental.models import MaterialDispatch
    from medical.models import SupplyKit

    busy_kit_ids = SupplyKit.objects.filter(
        organization=organization,
        status__in=OPEN_KIT_STATUSES,
    ).values_list("tags__id", flat=True)
    busy_dispatch_ids = MaterialDispatch.objects.filter(
        organization=organization,
        rfid_tag__isnull=False,
    ).exclude(status__in=CLOSED_DISPATCH_STATUSES).values_list("rfid_tag_id", flat=True)

    busy = set(tid for tid in busy_kit_ids if tid) | set(tid for tid in busy_dispatch_ids if tid)
    qs = RFIDTag.objects.filter(organization=organization).exclude(status=RFIDTagStatus.DADO_DE_BAJA)
    if busy:
        qs = qs.exclude(id__in=busy)
    return qs


def custody_payload_for_tag(tag: RFIDTag) -> dict:
    custody = get_open_custody(tag)
    if not custody:
        return {
            "is_available": tag.status != RFIDTagStatus.DADO_DE_BAJA,
            "custody_type": None,
            "custody_id": None,
            "custody_label": None,
            "custody_status": None,
        }
    return {
        "is_available": False,
        "custody_type": custody.type,
        "custody_id": custody.id,
        "custody_label": custody.label,
        "custody_status": custody.status,
    }

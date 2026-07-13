"""Platform admin services: provision / purge / assign packages for client demos."""

from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from organizations.models import (
    AccountType,
    Module,
    Organization,
    OrganizationMembership,
    OrganizationModule,
    OrganizationProduct,
    OrganizationRole,
    PlatformAuditLog,
    ProductPackage,
)

User = get_user_model()


def _audit(actor, action: str, organization=None, payload=None):
    PlatformAuditLog.objects.create(
        actor=actor if actor and getattr(actor, "is_authenticated", False) else None,
        action=action,
        organization=organization,
        payload=payload or {},
    )


def enable_modules_for_organization(organization: Organization, module_codes: list[str]):
    all_modules = {m.code: m for m in Module.objects.all()}
    for code, module in all_modules.items():
        org_mod, _ = OrganizationModule.objects.get_or_create(
            organization=organization,
            module=module,
            defaults={"is_active": code in module_codes},
        )
        want = code in module_codes
        if org_mod.is_active != want:
            org_mod.is_active = want
            org_mod.save()


def assign_package(organization: Organization, package: ProductPackage, actor=None, adapted_notes=""):
    org_product, _ = OrganizationProduct.objects.update_or_create(
        organization=organization,
        package=package,
        defaults={"is_active": True, "adapted_notes": adapted_notes},
    )
    module_codes = list(
        package.package_modules.order_by("sort_order").values_list("module__code", flat=True)
    )
    # Union with already-active modules from other packages
    active_codes = set(
        OrganizationModule.objects.filter(organization=organization, is_active=True).values_list(
            "module__code", flat=True
        )
    )
    active_codes.update(module_codes)
    enable_modules_for_organization(organization, list(active_codes))
    _audit(actor, "assign_package", organization, {"package": package.code, "modules": module_codes})
    return org_product


@transaction.atomic
def provision_demo(
    *,
    name: str,
    contact_email: str,
    contact_name: str = "",
    duration_days: int = 14,
    package_codes: list[str] | None = None,
    industry_type: str = "clinical",
    actor=None,
    password: str | None = None,
):
    """Create a demo organization, admin user, and assign product packages with dummy-ready modules."""
    package_codes = package_codes or ["pkg_instrumental"]
    base_slug = slugify(name)[:80] or "demo-client"
    slug = base_slug
    suffix = 1
    while Organization.objects.filter(slug=slug).exists():
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    expires = timezone.now() + timedelta(days=max(1, duration_days))
    organization = Organization.objects.create(
        name=name,
        slug=slug,
        industry_type=industry_type,
        account_type=AccountType.DEMO,
        is_active=True,
        contact_name=contact_name or name,
        contact_email=contact_email,
        demo_duration_days=duration_days,
        demo_expires_at=expires,
        demo_locked=False,
        sales_owner=actor if actor and getattr(actor, "is_authenticated", False) else None,
    )

    raw_password = password or secrets.token_urlsafe(10)
    user, created = User.objects.get_or_create(
        email=contact_email.lower().strip(),
        defaults={
            "is_active": True,
            "is_staff": False,
            "is_superuser": False,
        },
    )
    if created or password:
        user.set_password(raw_password)
        user.is_staff = False
        user.is_superuser = False
        user.is_active = True
        user.save()

    OrganizationMembership.objects.update_or_create(
        user=user,
        organization=organization,
        defaults={"role": OrganizationRole.ADMIN},
    )

    assigned = []
    for code in package_codes:
        try:
            package = ProductPackage.objects.get(code=code)
        except ProductPackage.DoesNotExist:
            continue
        assign_package(organization, package, actor=actor)
        assigned.append(code)

    if not assigned:
        # Fallback: enable instrumental product modules
        from organizations.constants import INSTRUMENTAL_PRODUCT_MODULES

        enable_modules_for_organization(
            organization,
            ["inventory_realtime", *INSTRUMENTAL_PRODUCT_MODULES],
        )

    _audit(
        actor,
        "provision_demo",
        organization,
        {
            "email": contact_email,
            "duration_days": duration_days,
            "packages": assigned,
            "expires_at": expires.isoformat(),
        },
    )

    return {
        "organization": organization,
        "user": user,
        "password": raw_password if created or password else None,
        "demo_expires_at": expires,
        "packages": assigned,
    }


@transaction.atomic
def purge_demo(organization: Organization, actor=None, deactivate: bool = True):
    """Delete tenant business data for a demo org. Refuses non-demo accounts."""
    if organization.account_type != AccountType.DEMO:
        raise ValueError("Solo se pueden purgar organizaciones con account_type=demo.")

    # Lazy imports to avoid circulars; delete by organization FK
    from inventory.models import RFIDReadEvent, RFIDTag
    from instrumental.models import (
        FulfillmentPlan,
        HandheldScanEvent,
        HospitalSite,
        InstrumentCatalogItem,
        InstrumentPriceContract,
        InstrumentProcedureRequest,
        InstrumentQuotation,
        MaterialDispatch,
        TransportVehicle,
    )
    from logistics.models import (
        Client,
        Product,
        Provider,
        PurchaseOrder,
        Requisition,
        SalesOrder,
    )
    from medical.models import Doctor, Procedure, ProcedureAssignment, SupplyKit, Technician

    counts = {}

    def wipe(label, qs):
        counts[label] = qs.count()
        qs.delete()

    wipe("handheld_scans", HandheldScanEvent.objects.filter(organization=organization))
    wipe("material_dispatches", MaterialDispatch.objects.filter(organization=organization))
    wipe("fulfillment_plans", FulfillmentPlan.objects.filter(organization=organization))
    wipe("quotations", InstrumentQuotation.objects.filter(organization=organization))
    wipe("instrument_requests", InstrumentProcedureRequest.objects.filter(organization=organization))
    wipe("instrument_contracts", InstrumentPriceContract.objects.filter(organization=organization))
    wipe("transport_vehicles", TransportVehicle.objects.filter(organization=organization))
    wipe("instrument_catalog", InstrumentCatalogItem.objects.filter(organization=organization))
    wipe("hospital_sites", HospitalSite.objects.filter(organization=organization))

    wipe("supply_kits", SupplyKit.objects.filter(organization=organization))
    wipe("procedure_assignments", ProcedureAssignment.objects.filter(organization=organization))
    wipe("procedures", Procedure.objects.filter(organization=organization))
    wipe("doctors", Doctor.objects.filter(organization=organization))
    wipe("technicians", Technician.objects.filter(organization=organization))

    wipe("sales_orders", SalesOrder.objects.filter(organization=organization))
    wipe("purchase_orders", PurchaseOrder.objects.filter(organization=organization))
    wipe("requisitions", Requisition.objects.filter(organization=organization))
    wipe("products", Product.objects.filter(organization=organization))
    wipe("clients", Client.objects.filter(organization=organization))
    wipe("providers", Provider.objects.filter(organization=organization))

    wipe("rfid_events", RFIDReadEvent.objects.filter(organization=organization))
    wipe("rfid_tags", RFIDTag.objects.filter(organization=organization))

    if deactivate:
        organization.is_active = False
        organization.demo_locked = True
        organization.save(update_fields=["is_active", "demo_locked", "modified"])
        user_ids = list(organization.memberships.values_list("user_id", flat=True))
        User.objects.filter(id__in=user_ids, is_superuser=False).update(is_active=False)

    _audit(actor, "purge_demo", organization, {"counts": counts, "deactivate": deactivate})
    return counts


def extend_demo(organization: Organization, extra_days: int, actor=None):
    if organization.account_type != AccountType.DEMO:
        raise ValueError("Solo demos se pueden extender.")
    base = organization.demo_expires_at or timezone.now()
    if base < timezone.now():
        base = timezone.now()
    organization.demo_expires_at = base + timedelta(days=max(1, extra_days))
    organization.demo_locked = False
    organization.is_active = True
    organization.demo_duration_days = (organization.demo_duration_days or 0) + extra_days
    organization.save(
        update_fields=["demo_expires_at", "demo_locked", "is_active", "demo_duration_days", "modified"]
    )
    _audit(actor, "extend_demo", organization, {"extra_days": extra_days})
    return organization

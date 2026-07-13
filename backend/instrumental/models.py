from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from organizations.models import OrganizationModel


class CatalogItemType(models.TextChoices):
    INSTRUMENT = "instrument", _("Instrumental")
    EQUIPMENT = "equipment", _("Equipo médico")
    TRAY = "tray", _("Charola")


class RequestStatus(models.TextChoices):
    DRAFT = "draft", _("Borrador")
    SUBMITTED = "submitted", _("Solicitada")
    QUOTATION = "quotation", _("En cotización")
    QUOTATION_ACCEPTED = "quotation_accepted", _("Cotización aceptada")
    FULFILLMENT = "fulfillment", _("En asignación")
    IN_FIELD = "in_field", _("En campo")
    RETURNING = "returning", _("En retorno")
    VALIDATED = "validated", _("Validado en almacén")
    COMPLETED = "completed", _("Completado")
    CANCELLED = "cancelled", _("Cancelado")


class QuotationStatus(models.TextChoices):
    DRAFT = "draft", _("Borrador")
    PENDING_DOCTOR = "pending_doctor", _("Pendiente doctor")
    ACCEPTED = "accepted", _("Aceptada")
    REJECTED = "rejected", _("Rechazada")


class FulfillmentStatus(models.TextChoices):
    PLANNING = "planning", _("Planificando")
    READY = "ready", _("Listo")
    DISPATCHED = "dispatched", _("Despachado")
    AT_HOSPITAL = "at_hospital", _("En hospital")
    RETURNING = "returning", _("Retornando")
    VALIDATED = "validated", _("Validado")


class DispatchStatus(models.TextChoices):
    ASSIGNED = "assigned", _("Asignado")
    STERILIZING = "sterilizing", _("Esterilizando")
    LOADED = "loaded", _("Cargado")
    IN_TRANSIT = "in_transit", _("En tránsito")
    AT_HOSPITAL = "at_hospital", _("En hospital")
    RETURNING = "returning", _("Retornando")
    RETURNED = "returned", _("Retornado")
    VALIDATED = "validated", _("Validado")


class SterilizationStatus(models.TextChoices):
    NOT_REQUIRED = "not_required", _("No requiere")
    PENDING = "pending", _("Pendiente")
    IN_PROGRESS = "in_progress", _("En proceso")
    READY = "ready", _("Listo")


class HandheldEventType(models.TextChoices):
    LOAD_DEPARTURE = "load_departure", _("Salida de almacén")
    HOSPITAL_ARRIVAL = "hospital_arrival", _("Llegada hospital")
    HOSPITAL_DEPARTURE = "hospital_departure", _("Salida hospital")
    RETURN_ARRIVAL = "return_arrival", _("Retorno a almacén")
    CRCAO_VALIDATION = "crcao_validation", _("Validación en almacén")


class HospitalSite(OrganizationModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=32)
    is_central = models.BooleanField(
        default=False,
        help_text=_("Marca el almacén central de la organización."),
    )
    city = models.CharField(max_length=128, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="unique_hospital_code_per_org",
            ),
        ]

    def __str__(self):
        return self.name


class InstrumentCatalogItem(OrganizationModel):
    sku = models.CharField(max_length=128)
    name = models.CharField(max_length=255)
    item_type = models.CharField(max_length=32, choices=CatalogItemType.choices)
    description = models.TextField(blank=True)
    requires_sterilization = models.BooleanField(default=False)
    default_unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_("Precio base si no hay contrato aplicable."),
    )
    rfid_tag = models.ForeignKey(
        "inventory.RFIDTag",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="instrument_catalog_items",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sku"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "sku"],
                name="unique_instrument_sku_per_org",
            ),
        ]

    def __str__(self):
        return f"{self.sku} — {self.name}"

    def clean(self):
        super().clean()
        if self.rfid_tag_id and self.rfid_tag.organization_id != self.organization_id:
            raise ValidationError("RFID tag must belong to the same organization.")


class InstrumentPriceContract(OrganizationModel):
    """Commercial rates scoped to doctor, hospital, or both."""

    name = models.CharField(max_length=255)
    doctor = models.ForeignKey(
        "medical.Doctor",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="instrument_price_contracts",
        help_text=_("Si se omite, el contrato aplica a cualquier doctor del hospital."),
    )
    hospital = models.ForeignKey(
        HospitalSite,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="instrument_price_contracts",
        help_text=_("Si se omite, el contrato aplica a cualquier hospital del doctor."),
    )
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(doctor__isnull=False) | models.Q(hospital__isnull=False),
                name="contract_requires_doctor_or_hospital",
            ),
            models.UniqueConstraint(
                fields=["organization", "doctor", "hospital"],
                condition=models.Q(doctor__isnull=False, hospital__isnull=False, is_active=True),
                name="unique_active_contract_doctor_hospital",
            ),
            models.UniqueConstraint(
                fields=["organization", "doctor"],
                condition=models.Q(doctor__isnull=False, hospital__isnull=True, is_active=True),
                name="unique_active_contract_doctor_only",
            ),
            models.UniqueConstraint(
                fields=["organization", "hospital"],
                condition=models.Q(doctor__isnull=True, hospital__isnull=False, is_active=True),
                name="unique_active_contract_hospital_only",
            ),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if not self.doctor_id and not self.hospital_id:
            raise ValidationError("Contract must target a doctor, a hospital, or both.")
        if self.doctor_id and self.doctor.organization_id != self.organization_id:
            raise ValidationError("Doctor must belong to the same organization.")
        if self.hospital_id and self.hospital.organization_id != self.organization_id:
            raise ValidationError("Hospital must belong to the same organization.")
        if self.valid_from and self.valid_to and self.valid_to < self.valid_from:
            raise ValidationError("valid_to must be on or after valid_from.")

    @property
    def scope_label(self):
        if self.doctor_id and self.hospital_id:
            return "doctor_hospital"
        if self.doctor_id:
            return "doctor"
        return "hospital"


class InstrumentContractLine(OrganizationModel):
    contract = models.ForeignKey(
        InstrumentPriceContract,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    catalog_item = models.ForeignKey(
        InstrumentCatalogItem,
        on_delete=models.PROTECT,
        related_name="contract_lines",
    )
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["contract", "catalog_item"],
                name="unique_contract_catalog_item",
            ),
        ]

    def clean(self):
        super().clean()
        if self.catalog_item.organization_id != self.contract.organization_id:
            raise ValidationError("Catalog item must belong to the same organization as the contract.")


class TransportVehicle(OrganizationModel):
    code = models.CharField(max_length=64)
    plate = models.CharField(max_length=32, blank=True)
    name = models.CharField(max_length=255)
    transporter_name = models.CharField(max_length=255, blank=True)
    rfid_tag = models.ForeignKey(
        "inventory.RFIDTag",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transport_vehicles",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="unique_vehicle_code_per_org",
            ),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"


class InstrumentProcedureRequest(OrganizationModel):
    procedure = models.ForeignKey(
        "medical.Procedure",
        on_delete=models.CASCADE,
        related_name="instrument_requests",
    )
    doctor = models.ForeignKey(
        "medical.Doctor",
        on_delete=models.CASCADE,
        related_name="instrument_requests",
    )
    destination_hospital = models.ForeignKey(
        HospitalSite,
        on_delete=models.PROTECT,
        related_name="instrument_requests",
    )
    status = models.CharField(
        max_length=32,
        choices=RequestStatus.choices,
        default=RequestStatus.DRAFT,
    )
    notes = models.TextField(blank=True)
    scheduled_start = models.DateTimeField(null=True, blank=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    estimated_out_hours = models.PositiveIntegerField(default=24)
    proximity_next_request = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="proximity_previous_requests",
    )

    class Meta:
        ordering = ["-created"]

    def __str__(self):
        return f"REQ-INST-{self.pk} ({self.procedure})"


class InstrumentRequestLine(OrganizationModel):
    request = models.ForeignKey(
        InstrumentProcedureRequest,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    catalog_item = models.ForeignKey(
        InstrumentCatalogItem,
        on_delete=models.PROTECT,
        related_name="request_lines",
    )
    quantity = models.PositiveIntegerField(default=1)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["id"]

    def clean(self):
        super().clean()
        if self.catalog_item.organization_id != self.request.organization_id:
            raise ValidationError("Catalog item must belong to the same organization.")


class InstrumentQuotation(OrganizationModel):
    request = models.OneToOneField(
        InstrumentProcedureRequest,
        on_delete=models.CASCADE,
        related_name="quotation",
    )
    status = models.CharField(
        max_length=32,
        choices=QuotationStatus.choices,
        default=QuotationStatus.DRAFT,
    )
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    notes = models.TextField(blank=True)
    applied_contract = models.ForeignKey(
        InstrumentPriceContract,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotations",
        help_text=_("Contrato principal usado al generar la cotización (si aplica)."),
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    doctor_responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created"]

    def __str__(self):
        return f"COT-{self.pk}"


class QuotationLine(OrganizationModel):
    quotation = models.ForeignKey(
        InstrumentQuotation,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    catalog_item = models.ForeignKey(
        InstrumentCatalogItem,
        on_delete=models.PROTECT,
        related_name="quotation_lines",
    )
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    requires_sterilization = models.BooleanField(default=False)
    price_source = models.CharField(
        max_length=32,
        blank=True,
        help_text=_("Origen del precio: doctor_hospital, doctor, hospital, catalog, default."),
    )
    applied_contract = models.ForeignKey(
        InstrumentPriceContract,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotation_lines",
    )

    class Meta:
        ordering = ["id"]

    @property
    def line_total(self):
        return self.quantity * self.unit_price


class FulfillmentPlan(OrganizationModel):
    request = models.OneToOneField(
        InstrumentProcedureRequest,
        on_delete=models.CASCADE,
        related_name="fulfillment_plan",
    )
    vehicle = models.ForeignKey(
        TransportVehicle,
        on_delete=models.PROTECT,
        related_name="fulfillment_plans",
    )
    lead_technician = models.ForeignKey(
        "medical.Technician",
        on_delete=models.PROTECT,
        related_name="instrument_fulfillment_plans",
    )
    status = models.CharField(
        max_length=32,
        choices=FulfillmentStatus.choices,
        default=FulfillmentStatus.PLANNING,
    )
    scheduled_departure = models.DateTimeField(null=True, blank=True)
    scheduled_return = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created"]

    def __str__(self):
        return f"PLAN-{self.pk}"


class MaterialDispatch(OrganizationModel):
    fulfillment = models.ForeignKey(
        FulfillmentPlan,
        on_delete=models.CASCADE,
        related_name="dispatches",
    )
    catalog_item = models.ForeignKey(
        InstrumentCatalogItem,
        on_delete=models.PROTECT,
        related_name="dispatches",
    )
    technician = models.ForeignKey(
        "medical.Technician",
        on_delete=models.PROTECT,
        related_name="material_dispatches",
    )
    tray_code = models.CharField(max_length=64, blank=True)
    rfid_tag = models.ForeignKey(
        "inventory.RFIDTag",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="material_dispatches",
    )
    sku = models.CharField(max_length=128, blank=True)
    requires_sterilization = models.BooleanField(default=False)
    sterilization_status = models.CharField(
        max_length=32,
        choices=SterilizationStatus.choices,
        default=SterilizationStatus.NOT_REQUIRED,
    )
    status = models.CharField(
        max_length=32,
        choices=DispatchStatus.choices,
        default=DispatchStatus.ASSIGNED,
    )
    current_hospital = models.ForeignKey(
        HospitalSite,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="material_dispatches",
    )
    loaded_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["id"]

    def clean(self):
        super().clean()
        if not self.rfid_tag_id and not self.sku:
            raise ValidationError("Material dispatch requires RFID tag or SKU.")
        org_id = self.fulfillment.organization_id
        if self.rfid_tag_id and self.rfid_tag.organization_id != org_id:
            raise ValidationError("RFID tag must belong to the same organization.")
        if self.catalog_item.organization_id != org_id:
            raise ValidationError("Catalog item must belong to the same organization.")

    @property
    def tracking_identifier(self):
        if self.rfid_tag_id:
            return self.rfid_tag.code
        return self.sku


class HandheldScanEvent(OrganizationModel):
    material_dispatch = models.ForeignKey(
        MaterialDispatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scan_events",
    )
    rfid_tag = models.ForeignKey(
        "inventory.RFIDTag",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="instrumental_scan_events",
    )
    sku = models.CharField(max_length=128, blank=True)
    identifier_used = models.CharField(max_length=128)
    event_type = models.CharField(max_length=32, choices=HandheldEventType.choices)
    hospital = models.ForeignKey(
        HospitalSite,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="handheld_scans",
    )
    handheld_id = models.CharField(max_length=64, blank=True)
    location_notes = models.CharField(max_length=255, blank=True)
    scanned_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-scanned_at"]


class ProximityScheduleLink(OrganizationModel):
    from_request = models.ForeignKey(
        InstrumentProcedureRequest,
        on_delete=models.CASCADE,
        related_name="proximity_outgoing_links",
    )
    to_request = models.ForeignKey(
        InstrumentProcedureRequest,
        on_delete=models.CASCADE,
        related_name="proximity_incoming_links",
    )
    reuse_dispatch = models.ForeignKey(
        MaterialDispatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="proximity_links",
    )
    minutes_between = models.PositiveIntegerField(default=60)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["from_request", "to_request"],
                name="unique_proximity_link",
            ),
        ]

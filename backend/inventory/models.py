from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from organizations.models import OrganizationModel


class RFIDTagStatus(models.TextChoices):
    EN_STOCK = "en_stock", _("En stock")
    EN_TRANSITO = "en_transito", _("En tránsito")
    EN_USO = "en_uso", _("En uso")
    DADO_DE_BAJA = "dado_de_baja", _("Dado de baja")


class InventoryLocationType(models.TextChoices):
    WAREHOUSE = "warehouse", _("Almacén")
    ZONE = "zone", _("Zona / anaquel")
    HOSPITAL = "hospital", _("Hospital")
    VEHICLE = "vehicle", _("Vehículo")
    OTHER = "other", _("Otro")


class InventoryLocation(OrganizationModel):
    """Catálogo de ubicaciones físicas para inventario RFID."""

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=64)
    location_type = models.CharField(
        max_length=32,
        choices=InventoryLocationType.choices,
        default=InventoryLocationType.WAREHOUSE,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="unique_inventory_location_code_per_org",
            ),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"


class RFIDTag(OrganizationModel):
    code = models.CharField(max_length=128)
    item_type = models.CharField(max_length=128, blank=True)
    catalog_item = models.ForeignKey(
        "instrumental.InstrumentCatalogItem",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rfid_units",
        help_text=_("Producto del catálogo al que pertenece esta unidad física."),
    )
    status = models.CharField(
        max_length=32,
        choices=RFIDTagStatus.choices,
        default=RFIDTagStatus.EN_STOCK,
    )
    last_location = models.CharField(max_length=255, blank=True)
    inventory_location = models.ForeignKey(
        InventoryLocation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rfid_tags",
    )
    lot = models.CharField(
        max_length=64,
        blank=True,
        help_text=_("Número de lote del producto (si aplica)."),
    )
    expires_on = models.DateField(
        null=True,
        blank=True,
        help_text=_("Fecha de caducidad (si aplica)."),
    )
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_read_at", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="unique_rfid_tag_code_per_organization",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "code"]),
        ]

    def __str__(self):
        return self.code

    def sync_denormalized_fields(self):
        """Keep free-text mirrors in sync with catalog FKs for filters/legacy UI."""
        if self.catalog_item_id:
            catalog = getattr(self, "catalog_item", None)
            if catalog is not None:
                self.item_type = catalog.name
        if self.inventory_location_id:
            location = getattr(self, "inventory_location", None)
            if location is not None:
                self.last_location = location.name

    def save(self, *args, **kwargs):
        self.sync_denormalized_fields()
        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            fields = set(update_fields)
            if self.catalog_item_id:
                fields.add("item_type")
            if self.inventory_location_id:
                fields.add("last_location")
            kwargs["update_fields"] = list(fields)
        super().save(*args, **kwargs)


class RFIDReadEvent(OrganizationModel):
    tag = models.ForeignKey(
        RFIDTag,
        on_delete=models.CASCADE,
        related_name="read_events",
    )
    timestamp = models.DateTimeField(default=timezone.now)
    location = models.CharField(max_length=255, blank=True)
    reader_source = models.CharField(max_length=255, blank=True)
    event_type = models.CharField(max_length=64)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["tag", "timestamp"]),
            models.Index(fields=["organization", "timestamp"]),
        ]

    def __str__(self):
        return f"{self.tag.code} @ {self.timestamp}"

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from organizations.models import OrganizationModel


class RFIDTagStatus(models.TextChoices):
    EN_STOCK = "en_stock", _("En stock")
    EN_TRANSITO = "en_transito", _("En tránsito")
    EN_USO = "en_uso", _("En uso")
    DADO_DE_BAJA = "dado_de_baja", _("Dado de baja")


class RFIDTag(OrganizationModel):
    code = models.CharField(max_length=128)
    item_type = models.CharField(max_length=128, blank=True)
    status = models.CharField(
        max_length=32,
        choices=RFIDTagStatus.choices,
        default=RFIDTagStatus.EN_STOCK,
    )
    last_location = models.CharField(max_length=255, blank=True)
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

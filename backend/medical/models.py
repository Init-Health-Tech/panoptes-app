from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from organizations.models import OrganizationModel


class ProcedureStatus(models.TextChoices):
    SCHEDULED = "scheduled", _("Programado")
    IN_PREPARATION = "in_preparation", _("En preparación")
    IN_TRANSIT = "in_transit", _("En tránsito")
    COMPLETED = "completed", _("Completado")
    CANCELLED = "cancelled", _("Cancelado")


class SupplyKitStatus(models.TextChoices):
    ARMANDO = "armando", _("Armando")
    LISTA = "lista", _("Lista")
    EN_TRANSITO = "en_transito", _("En tránsito")
    ENTREGADA = "entregada", _("Entregada")
    USADA = "usada", _("Usada")


class AssignmentRole(models.TextChoices):
    LEAD_TECHNICIAN = "lead_technician", _("Técnico principal")
    ASSISTANT = "assistant", _("Asistente")
    SUPERVISOR = "supervisor", _("Supervisor")


class Doctor(OrganizationModel):
    name = models.CharField(max_length=255)
    specialty = models.CharField(max_length=128, blank=True)
    hospital = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Technician(OrganizationModel):
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Procedure(OrganizationModel):
    procedure_type = models.CharField(max_length=255)
    destination_hospital = models.CharField(max_length=255)
    scheduled_date = models.DateField()
    status = models.CharField(
        max_length=32,
        choices=ProcedureStatus.choices,
        default=ProcedureStatus.SCHEDULED,
    )

    class Meta:
        ordering = ["-scheduled_date", "procedure_type"]
        verbose_name_plural = "procedures"

    def __str__(self):
        return f"{self.procedure_type} @ {self.destination_hospital}"


class ProcedureAssignment(OrganizationModel):
    procedure = models.ForeignKey(
        Procedure,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    technician = models.ForeignKey(
        Technician,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    role = models.CharField(max_length=32, choices=AssignmentRole.choices)

    class Meta:
        ordering = ["procedure", "role"]
        constraints = [
            models.UniqueConstraint(
                fields=["procedure", "technician", "doctor", "role"],
                name="unique_procedure_assignment",
            ),
        ]

    def __str__(self):
        return f"{self.procedure} — {self.technician}"

    def clean(self):
        super().clean()
        org = self.organization_id
        related = [self.procedure, self.technician, self.doctor]
        if any(obj.organization_id != org for obj in related if obj.pk):
            raise ValidationError("Procedure, technician and doctor must belong to the same organization.")


class SupplyKit(OrganizationModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=64)
    procedure = models.ForeignKey(
        Procedure,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supply_kits",
    )
    status = models.CharField(
        max_length=32,
        choices=SupplyKitStatus.choices,
        default=SupplyKitStatus.ARMANDO,
    )
    destination_hospital = models.CharField(max_length=255, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    tags = models.ManyToManyField(
        "inventory.RFIDTag",
        through="SupplyKitTag",
        related_name="supply_kits",
    )

    class Meta:
        ordering = ["-created"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="unique_supply_kit_code_per_organization",
            ),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"


class SupplyKitTag(OrganizationModel):
    supply_kit = models.ForeignKey(
        SupplyKit,
        on_delete=models.CASCADE,
        related_name="kit_tags",
    )
    tag = models.ForeignKey(
        "inventory.RFIDTag",
        on_delete=models.CASCADE,
        related_name="kit_memberships",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["supply_kit", "tag"],
                name="unique_supply_kit_tag",
            ),
        ]

    def clean(self):
        super().clean()
        if self.supply_kit.organization_id != self.tag.organization_id:
            raise ValidationError("RFID tag must belong to the same organization as the supply kit.")
        if self.organization_id and self.organization_id != self.supply_kit.organization_id:
            raise ValidationError("Organization must match the supply kit organization.")

    def save(self, *args, **kwargs):
        if self.supply_kit_id:
            self.organization = self.supply_kit.organization
        self.full_clean()
        super().save(*args, **kwargs)

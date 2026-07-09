import hashlib
import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from common.models import IndexedTimeStampedModel


class IndustryType(models.TextChoices):
    CLINICAL = "clinical", _("Clínico / hospitalario")
    LOGISTICS = "logistics", _("Logístico / comercial")
    MIXED = "mixed", _("Mixto")


class OrganizationRole(models.TextChoices):
    ADMIN = "admin", _("Administrador")
    WAREHOUSE = "warehouse", _("Almacén")
    TECHNICIAN = "technician", _("Técnico")
    DOCTOR = "doctor", _("Doctor")
    LOGISTICS_COORDINATOR = "logistics_coordinator", _("Coordinador logístico")

    @classmethod
    def all_values(cls):
        return [choice.value for choice in cls]


class Organization(IndexedTimeStampedModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    industry_type = models.CharField(
        max_length=20,
        choices=IndustryType.choices,
        default=IndustryType.MIXED,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Module(IndexedTimeStampedModel):
    code = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.name


class OrganizationModule(IndexedTimeStampedModel):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="organization_modules",
    )
    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name="organization_modules",
    )
    is_active = models.BooleanField(default=True)
    activated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "module"],
                name="unique_organization_module",
            ),
        ]
        ordering = ["organization", "module"]

    def __str__(self):
        return f"{self.organization} — {self.module.code}"

    def save(self, *args, **kwargs):
        if self.is_active and self.activated_at is None:
            self.activated_at = timezone.now()
        if not self.is_active:
            self.activated_at = None
        super().save(*args, **kwargs)


class OrganizationMembership(IndexedTimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="organization_memberships",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(max_length=32, choices=OrganizationRole.choices)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "organization"],
                name="unique_user_organization_membership",
            ),
        ]
        ordering = ["created"]

    def __str__(self):
        return f"{self.user.email} @ {self.organization} ({self.role})"


class OrganizationQuerySet(models.QuerySet):
    def for_organization(self, organization):
        if organization is None:
            return self.none()
        return self.filter(organization=organization)


class OrganizationManager(models.Manager):
    def get_queryset(self):
        return OrganizationQuerySet(self.model, using=self._db)

    def for_organization(self, organization):
        return self.get_queryset().for_organization(organization)


class OrganizationModel(IndexedTimeStampedModel):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="%(class)s_set",
    )

    objects = OrganizationManager()

    class Meta:
        abstract = True


def _hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


class OrganizationAPIKey(IndexedTimeStampedModel):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="api_keys",
    )
    prefix = models.CharField(max_length=16, db_index=True)
    key_hash = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    rotated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created"]

    def __str__(self):
        return f"{self.organization.slug}:{self.prefix}"

    @classmethod
    def generate_key(cls, organization):
        raw_key = secrets.token_urlsafe(32)
        prefix = raw_key[:8]
        api_key = cls.objects.create(
            organization=organization,
            prefix=prefix,
            key_hash=_hash_api_key(raw_key),
            is_active=True,
        )
        return api_key, raw_key

    @classmethod
    def rotate_key(cls, organization):
        cls.objects.filter(organization=organization, is_active=True).update(
            is_active=False,
            rotated_at=timezone.now(),
        )
        return cls.generate_key(organization)

    @classmethod
    def authenticate(cls, raw_key: str):
        if not raw_key or len(raw_key) < 8:
            return None
        prefix = raw_key[:8]
        key_hash = _hash_api_key(raw_key)
        try:
            api_key = cls.objects.select_related("organization").get(
                prefix=prefix,
                key_hash=key_hash,
                is_active=True,
                organization__is_active=True,
            )
        except cls.DoesNotExist:
            return None
        api_key.last_used_at = timezone.now()
        api_key.save(update_fields=["last_used_at", "modified"])
        return api_key

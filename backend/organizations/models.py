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


class AccountType(models.TextChoices):
    DEMO = "demo", _("Demo")
    CUSTOMER = "customer", _("Cliente")
    INTERNAL = "internal", _("Interno INIT")


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
    account_type = models.CharField(
        max_length=20,
        choices=AccountType.choices,
        default=AccountType.CUSTOMER,
        db_index=True,
    )
    is_active = models.BooleanField(default=True)
    contact_name = models.CharField(max_length=255, blank=True)
    contact_email = models.EmailField(blank=True)
    notes = models.TextField(blank=True)
    sales_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_organizations",
    )
    demo_duration_days = models.PositiveIntegerField(default=14)
    demo_expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    demo_locked = models.BooleanField(
        default=False,
        help_text=_("Bloqueada por caducidad de demo; solo CTA a ventas."),
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def is_demo(self) -> bool:
        return self.account_type == AccountType.DEMO

    @property
    def is_demo_expired(self) -> bool:
        if not self.is_demo:
            return False
        if self.demo_locked:
            return True
        if self.demo_expires_at is None:
            return False
        return timezone.now() >= self.demo_expires_at


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


class ProductPackage(IndexedTimeStampedModel):
    """Sellable / assignable product bundle (not logistics SKU)."""

    code = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(
        default=True,
        help_text=_("Visible para asignar a clientes desde platform admin."),
    )

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.name


class ProductPackageModule(IndexedTimeStampedModel):
    package = models.ForeignKey(
        ProductPackage,
        on_delete=models.CASCADE,
        related_name="package_modules",
    )
    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name="package_modules",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["package", "module"],
                name="unique_product_package_module",
            ),
        ]
        ordering = ["package", "sort_order", "module__code"]

    def __str__(self):
        return f"{self.package.code} → {self.module.code}"


class OrganizationProduct(IndexedTimeStampedModel):
    """Package assigned to a client, optionally adapted via config JSON."""

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="organization_products",
    )
    package = models.ForeignKey(
        ProductPackage,
        on_delete=models.CASCADE,
        related_name="organization_products",
    )
    is_active = models.BooleanField(default=True)
    adapted_notes = models.TextField(
        blank=True,
        help_text=_("Notas de adaptación del producto a este cliente."),
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text=_("Feature flags / overrides por cliente."),
    )
    activated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "package"],
                name="unique_organization_product",
            ),
        ]
        ordering = ["organization", "package"]

    def __str__(self):
        return f"{self.organization} — {self.package.code}"

    def save(self, *args, **kwargs):
        if self.is_active and self.activated_at is None:
            self.activated_at = timezone.now()
        if not self.is_active:
            self.activated_at = None
        super().save(*args, **kwargs)


class UsageEvent(IndexedTimeStampedModel):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="usage_events",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="usage_events",
    )
    path = models.CharField(max_length=512)
    method = models.CharField(max_length=16)
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    module_code = models.SlugField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)

    class Meta:
        ordering = ["-created"]
        indexes = [
            models.Index(fields=["organization", "-created"]),
            models.Index(fields=["organization", "module_code", "-created"]),
            models.Index(fields=["ip_address", "-created"]),
        ]

    def __str__(self):
        return f"{self.organization_id} {self.method} {self.path}"


class UsageDailyRollup(IndexedTimeStampedModel):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="usage_rollups",
    )
    day = models.DateField(db_index=True)
    module_code = models.SlugField(max_length=64, blank=True, default="")
    request_count = models.PositiveIntegerField(default=0)
    unique_users = models.PositiveIntegerField(default=0)
    unique_ips = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "day", "module_code"],
                name="unique_usage_daily_rollup",
            ),
        ]
        ordering = ["-day", "organization"]

    def __str__(self):
        return f"{self.organization_id} {self.day} {self.module_code or '*'}"


class PlatformAuditLog(IndexedTimeStampedModel):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="platform_audit_logs",
    )
    action = models.CharField(max_length=64)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="platform_audit_logs",
    )
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created"]

    def __str__(self):
        return f"{self.action} @ {self.created}"

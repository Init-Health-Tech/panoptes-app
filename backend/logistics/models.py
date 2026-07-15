from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from organizations.models import OrganizationModel


class RequisitionStatus(models.TextChoices):
    SOLICITADA = "solicitada", _("Solicitada")
    APROBADA = "aprobada", _("Aprobada")
    EN_TRANSITO = "en_transito", _("En tránsito")
    ENTREGADA = "entregada", _("Entregada")


class RequisitionType(models.TextChoices):
    SALIDA = "salida", _("Salida")
    ENTRADA = "entrada", _("Entrada")


class OrderStatus(models.TextChoices):
    BORRADOR = "borrador", _("Borrador")
    CONFIRMADA = "confirmada", _("Confirmada")
    EN_TRANSITO = "en_transito", _("En tránsito")
    ENTREGADA = "entregada", _("Entregada")
    CANCELADA = "cancelada", _("Cancelada")


class Product(OrganizationModel):
    sku = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=128, blank=True)
    unit = models.CharField(max_length=32, default="pza")

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "sku"],
                name="unique_product_sku_per_organization",
            ),
        ]

    def __str__(self):
        return f"{self.sku} — {self.name}"


class Client(OrganizationModel):
    business_name = models.CharField(max_length=255)
    contact = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["business_name"]

    def __str__(self):
        return self.business_name


class Provider(OrganizationModel):
    business_name = models.CharField(max_length=255)
    contact = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["business_name"]

    def __str__(self):
        return self.business_name


class Requisition(OrganizationModel):
    movement_type = models.CharField(
        max_length=16,
        choices=RequisitionType.choices,
        default=RequisitionType.SALIDA,
    )
    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    status = models.CharField(
        max_length=32,
        choices=RequisitionStatus.choices,
        default=RequisitionStatus.SOLICITADA,
    )
    requested_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        return f"REQ {self.id} — {self.origin} → {self.destination}"


class RequisitionLine(OrganizationModel):
    requisition = models.ForeignKey(
        Requisition,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="requisition_lines",
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product.sku} x{self.quantity}"


class SalesOrder(OrganizationModel):
    client = models.ForeignKey(
        Client,
        on_delete=models.PROTECT,
        related_name="sales_orders",
    )
    status = models.CharField(
        max_length=32,
        choices=OrderStatus.choices,
        default=OrderStatus.BORRADOR,
    )
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    ordered_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-ordered_at"]

    def __str__(self):
        return f"SO-{self.id} — {self.client}"


class SalesOrderLine(OrganizationModel):
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="sales_order_lines",
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product.sku} x{self.quantity}"


class PurchaseOrder(OrganizationModel):
    provider = models.ForeignKey(
        Provider,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
    )
    status = models.CharField(
        max_length=32,
        choices=OrderStatus.choices,
        default=OrderStatus.BORRADOR,
    )
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    ordered_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-ordered_at"]

    def __str__(self):
        return f"PO-{self.id} — {self.provider}"


class PurchaseOrderLine(OrganizationModel):
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="purchase_order_lines",
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product.sku} x{self.quantity}"

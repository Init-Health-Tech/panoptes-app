from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from logistics.models import (
    Client,
    Product,
    Provider,
    PurchaseOrder,
    PurchaseOrderLine,
    Requisition,
    RequisitionLine,
    SalesOrder,
    SalesOrderLine,
)


def _validate_product_org(product, organization):
    if product.organization_id != organization.id:
        raise serializers.ValidationError("Product must belong to your organization.")


def _validate_client_org(client, organization):
    if client.organization_id != organization.id:
        raise serializers.ValidationError("Client must belong to your organization.")


def _validate_provider_org(provider, organization):
    if provider.organization_id != organization.id:
        raise serializers.ValidationError("Provider must belong to your organization.")


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [  # noqa: RUF012
            "id",
            "sku",
            "name",
            "category",
            "unit",
            "created",
            "modified",
        ]


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [  # noqa: RUF012
            "id",
            "business_name",
            "contact",
            "created",
            "modified",
        ]


class ProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provider
        fields = [  # noqa: RUF012
            "id",
            "business_name",
            "contact",
            "created",
            "modified",
        ]


class RequisitionLineSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = RequisitionLine
        fields = [  # noqa: RUF012
            "id",
            "product",
            "product_sku",
            "product_name",
            "quantity",
        ]

    def validate_product(self, product):
        _validate_product_org(product, self.context["organization"])
        return product


class RequisitionSerializer(serializers.ModelSerializer):
    lines = RequisitionLineSerializer(many=True, required=False)

    class Meta:
        model = Requisition
        fields = [  # noqa: RUF012
            "id",
            "movement_type",
            "origin",
            "destination",
            "status",
            "requested_at",
            "lines",
            "created",
            "modified",
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        organization = validated_data.pop("organization", self.context["organization"])
        requisition = Requisition.objects.create(organization=organization, **validated_data)
        for line_data in lines_data:
            RequisitionLine.objects.create(
                organization=organization,
                requisition=requisition,
                **line_data,
            )
        return requisition

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines_data is not None:
            organization = self.context["organization"]
            instance.lines.all().delete()
            for line_data in lines_data:
                RequisitionLine.objects.create(
                    organization=organization,
                    requisition=instance,
                    **line_data,
                )
        return instance


class SalesOrderLineSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrderLine
        fields = [  # noqa: RUF012
            "id",
            "product",
            "product_sku",
            "product_name",
            "quantity",
            "unit_price",
            "line_total",
        ]

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2))
    def get_line_total(self, obj):
        return obj.quantity * obj.unit_price

    def validate_product(self, product):
        _validate_product_org(product, self.context["organization"])
        return product


class SalesOrderSerializer(serializers.ModelSerializer):
    lines = SalesOrderLineSerializer(many=True, required=False)
    client_name = serializers.CharField(source="client.business_name", read_only=True)

    class Meta:
        model = SalesOrder
        fields = [  # noqa: RUF012
            "id",
            "client",
            "client_name",
            "status",
            "total",
            "ordered_at",
            "lines",
            "created",
            "modified",
        ]

    def validate_client(self, client):
        _validate_client_org(client, self.context["organization"])
        return client

    def _compute_total(self, lines_data):
        return sum(
            (line["quantity"] * line["unit_price"] for line in lines_data),
            Decimal("0.00"),
        )

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        organization = validated_data.pop("organization", self.context["organization"])
        total = self._compute_total(lines_data) if lines_data else Decimal("0.00")
        order = SalesOrder.objects.create(organization=organization, total=total, **validated_data)
        for line_data in lines_data:
            SalesOrderLine.objects.create(
                organization=organization,
                sales_order=order,
                **line_data,
            )
        return order

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if lines_data is not None:
            organization = self.context["organization"]
            instance.lines.all().delete()
            for line_data in lines_data:
                SalesOrderLine.objects.create(
                    organization=organization,
                    sales_order=instance,
                    **line_data,
                )
            instance.total = self._compute_total(lines_data)
        instance.save()
        return instance


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderLine
        fields = [  # noqa: RUF012
            "id",
            "product",
            "product_sku",
            "product_name",
            "quantity",
            "unit_price",
            "line_total",
        ]

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2))
    def get_line_total(self, obj):
        return obj.quantity * obj.unit_price

    def validate_product(self, product):
        _validate_product_org(product, self.context["organization"])
        return product


class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = PurchaseOrderLineSerializer(many=True, required=False)
    provider_name = serializers.CharField(source="provider.business_name", read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [  # noqa: RUF012
            "id",
            "provider",
            "provider_name",
            "status",
            "total",
            "ordered_at",
            "lines",
            "created",
            "modified",
        ]

    def validate_provider(self, provider):
        _validate_provider_org(provider, self.context["organization"])
        return provider

    def _compute_total(self, lines_data):
        return sum(
            (line["quantity"] * line["unit_price"] for line in lines_data),
            Decimal("0.00"),
        )

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        organization = validated_data.pop("organization", self.context["organization"])
        total = self._compute_total(lines_data) if lines_data else Decimal("0.00")
        order = PurchaseOrder.objects.create(organization=organization, total=total, **validated_data)
        for line_data in lines_data:
            PurchaseOrderLine.objects.create(
                organization=organization,
                purchase_order=order,
                **line_data,
            )
        return order

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if lines_data is not None:
            organization = self.context["organization"]
            instance.lines.all().delete()
            for line_data in lines_data:
                PurchaseOrderLine.objects.create(
                    organization=organization,
                    purchase_order=instance,
                    **line_data,
                )
            instance.total = self._compute_total(lines_data)
        instance.save()
        return instance


class LogisticsDashboardStatsSerializer(serializers.Serializer):
    pending_requisitions = serializers.IntegerField()
    requisitions_in_transit = serializers.IntegerField()
    open_sales_orders = serializers.IntegerField()
    open_purchase_orders = serializers.IntegerField()

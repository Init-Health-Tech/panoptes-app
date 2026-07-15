from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from logistics.models import (
    Client,
    OrderStatus,
    Product,
    Provider,
    PurchaseOrder,
    Requisition,
    RequisitionStatus,
    SalesOrder,
)
from logistics.serializers import (
    ClientSerializer,
    LogisticsDashboardStatsSerializer,
    ProductSerializer,
    ProviderSerializer,
    PurchaseOrderSerializer,
    RequisitionSerializer,
    SalesOrderSerializer,
)
from organizations.mixins import OrganizationViewSetMixin
from organizations.permissions import has_module_and_role


class OrganizationSerializerContextMixin:
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self.get_organization()
        return context


class ProductViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("logistics_catalog")]

    def get_queryset(self):
        queryset = super().get_queryset()
        if category := self.request.query_params.get("category"):
            queryset = queryset.filter(category__icontains=category)
        return queryset


class ClientViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("logistics_catalog")]


class ProviderViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("logistics_catalog")]


@extend_schema_view(
    list=extend_schema(
        parameters=[OpenApiParameter("status", str, OpenApiParameter.QUERY)],
    ),
)
class RequisitionViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = Requisition.objects.prefetch_related("lines", "lines__product")
    serializer_class = RequisitionSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("logistics_requisitions")]

    def get_queryset(self):
        queryset = super().get_queryset()
        if status_param := self.request.query_params.get("status"):
            queryset = queryset.filter(status=status_param)
        return queryset


@extend_schema_view(
    list=extend_schema(
        parameters=[OpenApiParameter("status", str, OpenApiParameter.QUERY)],
    ),
)
class SalesOrderViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = SalesOrder.objects.select_related("client").prefetch_related("lines", "lines__product")
    serializer_class = SalesOrderSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("logistics_sales_purchases")]

    def get_queryset(self):
        queryset = super().get_queryset()
        if status_param := self.request.query_params.get("status"):
            queryset = queryset.filter(status=status_param)
        return queryset


@extend_schema_view(
    list=extend_schema(
        parameters=[OpenApiParameter("status", str, OpenApiParameter.QUERY)],
    ),
)
class PurchaseOrderViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.select_related("provider").prefetch_related("lines", "lines__product")
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("logistics_sales_purchases")]

    def get_queryset(self):
        queryset = super().get_queryset()
        if status_param := self.request.query_params.get("status"):
            queryset = queryset.filter(status=status_param)
        return queryset


class ScanProductView(APIView):
    """Resuelve un identificador (EPC hex, ASCII o SKU) a un producto de logística.

    Se usa para armar líneas de requisición leyendo tags RFID con un handheld o
    tecleando el SKU manualmente. El tag RFID se mapea al producto por nombre
    (``item_type``) o por catálogo; si no hay tag, se intenta por SKU/nombre.
    """

    permission_classes = [IsAuthenticated, has_module_and_role("logistics_requisitions")]

    def post(self, request):
        organization = request.organization
        identifier = str(request.data.get("identifier") or "").strip()
        if not identifier:
            return Response(
                {"detail": "El identificador es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from inventory.models import RFIDTag
        from inventory.rfid_code import find_rfid_tag_by_code

        tag = find_rfid_tag_by_code(RFIDTag.objects.filter(organization=organization), identifier)
        product = None
        matched_by = None

        if tag is not None:
            name = tag.item_type or ""
            if not name and tag.catalog_item_id:
                name = getattr(tag.catalog_item, "name", "") or ""
            if name:
                product = Product.objects.filter(organization=organization, name__iexact=name).first()
            if product is not None:
                matched_by = "rfid"

        if product is None:
            product = (
                Product.objects.filter(organization=organization, sku__iexact=identifier).first()
                or Product.objects.filter(organization=organization, name__iexact=identifier).first()
            )
            if product is not None:
                matched_by = "sku"

        if product is None:
            detail = (
                f"El tag '{identifier}' no está ligado a ningún producto."
                if tag is not None
                else f"No se encontró un producto para '{identifier}'."
            )
            return Response({"detail": detail}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            {
                "product": {
                    "id": product.id,
                    "sku": product.sku,
                    "name": product.name,
                },
                "tag_code": tag.code if tag is not None else None,
                "matched_by": matched_by,
            }
        )


class LogisticsDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role("logistics_requisitions")]

    @extend_schema(responses=LogisticsDashboardStatsSerializer)
    def get(self, request):
        organization = request.organization
        requisitions = Requisition.objects.for_organization(organization)
        sales = SalesOrder.objects.for_organization(organization)
        purchases = PurchaseOrder.objects.for_organization(organization)
        open_statuses = [OrderStatus.BORRADOR, OrderStatus.CONFIRMADA, OrderStatus.EN_TRANSITO]

        payload = {
            "pending_requisitions": requisitions.filter(status=RequisitionStatus.SOLICITADA).count(),
            "requisitions_in_transit": requisitions.filter(status=RequisitionStatus.EN_TRANSITO).count(),
            "open_sales_orders": sales.filter(status__in=open_statuses).count(),
            "open_purchase_orders": purchases.filter(status__in=open_statuses).count(),
        }
        return Response(payload)

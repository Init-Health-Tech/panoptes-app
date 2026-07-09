from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.apps import InventoryConfig
from inventory.models import RFIDReadEvent, RFIDTag
from inventory.serializers import (
    RFIDReadEventSerializer,
    RFIDReadWebhookSerializer,
    RFIDTagSerializer,
)
from organizations.authentication import OrganizationAPIKeyAuthentication
from organizations.mixins import OrganizationViewSetMixin
from organizations.permissions import has_module_and_role


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter("status", str, OpenApiParameter.QUERY),
            OpenApiParameter("location", str, OpenApiParameter.QUERY),
            OpenApiParameter("item_type", str, OpenApiParameter.QUERY),
        ],
    ),
)
class RFIDTagViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = RFIDTag.objects.all()
    serializer_class = RFIDTagSerializer
    permission_classes = [IsAuthenticated, has_module_and_role(InventoryConfig.module_code)]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        if status_param := params.get("status"):
            queryset = queryset.filter(status=status_param)
        if location := params.get("location"):
            queryset = queryset.filter(last_location__icontains=location)
        if item_type := params.get("item_type"):
            queryset = queryset.filter(item_type__icontains=item_type)

        return queryset


class RFIDReadEventViewSet(
    OrganizationViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = RFIDReadEvent.objects.select_related("tag")
    serializer_class = RFIDReadEventSerializer
    permission_classes = [IsAuthenticated, has_module_and_role(InventoryConfig.module_code)]

    def get_queryset(self):
        queryset = super().get_queryset()
        if tag_id := self.request.query_params.get("tag"):
            queryset = queryset.filter(tag_id=tag_id)
        return queryset


class RFIDReadWebhookView(APIView):
    authentication_classes = [OrganizationAPIKeyAuthentication]

    def get_permissions(self):
        return [AllowAny()]

    def get_authenticators(self):
        return [OrganizationAPIKeyAuthentication()]

    @extend_schema(request=RFIDReadWebhookSerializer, responses={201: RFIDTagSerializer})
    def post(self, request):
        organization = request.organization
        if organization is None:
            return Response({"detail": "Invalid API key."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = RFIDReadWebhookSerializer(
            data=request.data,
            context={"organization": organization},
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        response_data = {
            "tag": RFIDTagSerializer(result["tag"]).data,
            "event_id": result["event"].id,
            "tag_created": result["created"],
        }
        return Response(response_data, status=status.HTTP_201_CREATED)


class InventoryDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role(InventoryConfig.module_code)]

    def get(self, request):
        organization = request.organization
        tags = RFIDTag.objects.for_organization(organization)
        return Response(
            {
                "active_tags": tags.exclude(status="dado_de_baja").count(),
                "tags_in_stock": tags.filter(status="en_stock").count(),
                "tags_in_transit": tags.filter(status="en_transito").count(),
                "tags_in_use": tags.filter(status="en_uso").count(),
            }
        )

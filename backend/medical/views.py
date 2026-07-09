from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from medical.models import (
    Doctor,
    Procedure,
    ProcedureAssignment,
    ProcedureStatus,
    SupplyKit,
    SupplyKitStatus,
    SupplyKitTag,
    Technician,
)
from medical.serializers import (
    DoctorSerializer,
    MedicalDashboardStatsSerializer,
    ProcedureAssignmentSerializer,
    ProcedureSerializer,
    SupplyKitSerializer,
    SupplyKitTagActionSerializer,
    TechnicianSerializer,
)
from organizations.mixins import OrganizationViewSetMixin
from organizations.permissions import has_module_and_role


class DoctorViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("medical_staff")]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self.get_organization()
        return context


class TechnicianViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = Technician.objects.all()
    serializer_class = TechnicianSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("medical_staff")]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self.get_organization()
        return context


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter("status", str, OpenApiParameter.QUERY),
        ],
    ),
)
class ProcedureViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = Procedure.objects.all()
    serializer_class = ProcedureSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("medical_supplies")]

    def get_queryset(self):
        queryset = super().get_queryset()
        if status_param := self.request.query_params.get("status"):
            queryset = queryset.filter(status=status_param)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self.get_organization()
        return context


class ProcedureAssignmentViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = ProcedureAssignment.objects.select_related("procedure", "technician", "doctor")
    serializer_class = ProcedureAssignmentSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("medical_staff")]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self.get_organization()
        return context


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter("status", str, OpenApiParameter.QUERY),
        ],
    ),
)
class SupplyKitViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = SupplyKit.objects.prefetch_related("tags")
    serializer_class = SupplyKitSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("medical_kits")]

    def get_queryset(self):
        queryset = super().get_queryset()
        if status_param := self.request.query_params.get("status"):
            queryset = queryset.filter(status=status_param)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self.get_organization()
        return context

    @action(detail=True, methods=["post"], url_path="add-tags")
    def add_tags(self, request, pk=None):
        supply_kit = self.get_object()
        serializer = SupplyKitTagActionSerializer(
            data=request.data,
            context={"organization": self.get_organization()},
        )
        serializer.is_valid(raise_exception=True)
        for tag in serializer.validated_data["tag_ids"]:
            SupplyKitTag.objects.get_or_create(
                supply_kit=supply_kit,
                tag=tag,
                defaults={"organization": supply_kit.organization},
            )
        supply_kit = SupplyKit.objects.prefetch_related("tags").get(pk=supply_kit.pk)
        return Response(SupplyKitSerializer(supply_kit, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="remove-tags")
    def remove_tags(self, request, pk=None):
        supply_kit = self.get_object()
        serializer = SupplyKitTagActionSerializer(
            data=request.data,
            context={"organization": self.get_organization()},
        )
        serializer.is_valid(raise_exception=True)
        tag_ids = [tag.id for tag in serializer.validated_data["tag_ids"]]
        SupplyKitTag.objects.filter(supply_kit=supply_kit, tag_id__in=tag_ids).delete()
        supply_kit = SupplyKit.objects.prefetch_related("tags").get(pk=supply_kit.pk)
        return Response(SupplyKitSerializer(supply_kit, context=self.get_serializer_context()).data)


class MedicalDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role("medical_kits")]

    @extend_schema(responses=MedicalDashboardStatsSerializer)
    def get(self, request):
        organization = request.organization
        kits = SupplyKit.objects.for_organization(organization)
        procedures = Procedure.objects.for_organization(organization)
        payload = {
            "kits_in_transit": kits.filter(status=SupplyKitStatus.EN_TRANSITO).count(),
            "kits_assembling": kits.filter(status=SupplyKitStatus.ARMANDO).count(),
            "active_procedures": procedures.exclude(
                status__in=[ProcedureStatus.COMPLETED, ProcedureStatus.CANCELLED],
            ).count(),
        }
        return Response(payload)

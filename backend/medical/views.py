from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.custody import CustodyError, assert_tags_available, sync_kit_tags_status
from inventory.models import RFIDTagStatus
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
    SupplyKitDispatchSerializer,
    SupplyKitReturnChecklistSerializer,
    SupplyKitSerializer,
    SupplyKitTagActionSerializer,
    TechnicianSerializer,
)
from organizations.mixins import OrganizationViewSetMixin
from organizations.permissions import has_module_and_role


class DoctorViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer
    permission_classes = [IsAuthenticated, has_module_and_role(("medical_staff", "instrumental_control"))]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self.get_organization()
        return context


class TechnicianViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = Technician.objects.all()
    serializer_class = TechnicianSerializer
    permission_classes = [IsAuthenticated, has_module_and_role(("medical_staff", "instrumental_control"))]

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
    queryset = Procedure.objects.select_related("doctor")
    serializer_class = ProcedureSerializer
    permission_classes = [IsAuthenticated, has_module_and_role(("medical_supplies", "instrumental_control"))]

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
    permission_classes = [IsAuthenticated, has_module_and_role(("medical_staff", "instrumental_control"))]

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
    queryset = SupplyKit.objects.select_related(
        "procedure",
        "procedure__doctor",
        "assigned_technician",
    ).prefetch_related("tags")
    serializer_class = SupplyKitSerializer
    permission_classes = [IsAuthenticated, has_module_and_role(("medical_kits", "instrumental_control"))]

    def get_queryset(self):
        queryset = super().get_queryset()
        if status_param := self.request.query_params.get("status"):
            queryset = queryset.filter(status=status_param)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self.get_organization()
        return context

    def _serialized(self, supply_kit):
        supply_kit = SupplyKit.objects.select_related(
            "procedure",
            "procedure__doctor",
            "assigned_technician",
        ).prefetch_related("tags").get(pk=supply_kit.pk)
        return SupplyKitSerializer(supply_kit, context=self.get_serializer_context()).data

    @extend_schema(request=SupplyKitTagActionSerializer, responses=SupplyKitSerializer)
    @action(detail=True, methods=["post"], url_path="add-tags")
    def add_tags(self, request, pk=None):
        supply_kit = self.get_object()
        if supply_kit.status not in (SupplyKitStatus.ARMANDO, SupplyKitStatus.LISTA):
            return Response(
                {"detail": "Solo se pueden asignar tags mientras se arma la carga."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = SupplyKitTagActionSerializer(
            data=request.data,
            context={"organization": self.get_organization()},
        )
        serializer.is_valid(raise_exception=True)
        tags = serializer.validated_data["tag_ids"]
        try:
            assert_tags_available(tags, exclude_kit_id=supply_kit.id)
        except CustodyError as exc:
            return Response(exc.as_response_data(), status=status.HTTP_400_BAD_REQUEST)

        for tag in tags:
            SupplyKitTag.objects.get_or_create(
                supply_kit=supply_kit,
                tag=tag,
                defaults={"organization": supply_kit.organization},
            )
        return Response(self._serialized(supply_kit))

    @extend_schema(request=SupplyKitTagActionSerializer, responses=SupplyKitSerializer)
    @action(detail=True, methods=["post"], url_path="remove-tags")
    def remove_tags(self, request, pk=None):
        supply_kit = self.get_object()
        if supply_kit.status not in (SupplyKitStatus.ARMANDO, SupplyKitStatus.LISTA):
            return Response(
                {"detail": "Solo se pueden quitar tags mientras se arma la carga."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = SupplyKitTagActionSerializer(
            data=request.data,
            context={"organization": self.get_organization()},
        )
        serializer.is_valid(raise_exception=True)
        tag_ids = [tag.id for tag in serializer.validated_data["tag_ids"]]
        SupplyKitTag.objects.filter(supply_kit=supply_kit, tag_id__in=tag_ids).delete()
        return Response(self._serialized(supply_kit))

    @extend_schema(request=SupplyKitDispatchSerializer, responses=SupplyKitSerializer)
    @action(detail=True, methods=["post"], url_path="assign-dispatch")
    def assign_dispatch(self, request, pk=None):
        """Assign transporter + technician and mark kit as in transit."""
        supply_kit = self.get_object()
        if supply_kit.status not in (SupplyKitStatus.ARMANDO, SupplyKitStatus.LISTA):
            return Response(
                {"detail": "Only kits in armando/lista can be dispatched."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not supply_kit.tags.exists():
            return Response(
                {"detail": "Assign at least one RFID tag before dispatch."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SupplyKitDispatchSerializer(
            data=request.data,
            context={"organization": self.get_organization()},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        supply_kit.transporter_name = data["transporter_name"]
        supply_kit.assigned_technician = data["assigned_technician"]
        supply_kit.status = SupplyKitStatus.EN_TRANSITO
        supply_kit.shipped_at = timezone.now()
        supply_kit.return_checklist = supply_kit.build_return_checklist()
        supply_kit.save()
        sync_kit_tags_status(
            supply_kit,
            status=RFIDTagStatus.EN_TRANSITO,
            location=supply_kit.destination_hospital or "En tránsito",
        )
        return Response(self._serialized(supply_kit))

    @extend_schema(request=None, responses=SupplyKitSerializer)
    @action(detail=True, methods=["post"], url_path="confirm-hospital-arrival")
    def confirm_hospital_arrival(self, request, pk=None):
        """Technician confirms material arrived at hospital."""
        supply_kit = self.get_object()
        if supply_kit.status != SupplyKitStatus.EN_TRANSITO:
            return Response(
                {"detail": "Kit must be in transit to confirm hospital arrival."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        supply_kit.status = SupplyKitStatus.ENTREGADA
        supply_kit.hospital_arrived_at = timezone.now()
        if not supply_kit.return_checklist:
            supply_kit.return_checklist = supply_kit.build_return_checklist()
        supply_kit.save()
        sync_kit_tags_status(
            supply_kit,
            status=RFIDTagStatus.EN_USO,
            location=supply_kit.destination_hospital or "Hospital",
        )
        return Response(self._serialized(supply_kit))

    @extend_schema(request=SupplyKitReturnChecklistSerializer, responses=SupplyKitSerializer)
    @action(detail=True, methods=["post"], url_path="update-return-checklist")
    def update_return_checklist(self, request, pk=None):
        """Technician updates return-to-warehouse checklist."""
        supply_kit = self.get_object()
        if supply_kit.status not in (SupplyKitStatus.ENTREGADA, SupplyKitStatus.RETORNANDO):
            return Response(
                {"detail": "Checklist available after hospital delivery."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = SupplyKitReturnChecklistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data["items"]
        supply_kit.return_checklist = items
        if all(item.get("checked") for item in items) and items:
            supply_kit.status = SupplyKitStatus.RETORNANDO
            sync_kit_tags_status(
                supply_kit,
                status=RFIDTagStatus.EN_TRANSITO,
                location="Retorno a almacén",
            )
        else:
            supply_kit.status = SupplyKitStatus.ENTREGADA
        supply_kit.save(update_fields=["return_checklist", "status", "modified"])
        return Response(self._serialized(supply_kit))

    @extend_schema(request=None, responses=SupplyKitSerializer)
    @action(detail=True, methods=["post"], url_path="confirm-warehouse-return")
    def confirm_warehouse_return(self, request, pk=None):
        """Warehouse confirms returned material."""
        supply_kit = self.get_object()
        if supply_kit.status != SupplyKitStatus.RETORNANDO:
            return Response(
                {"detail": "Kit must be returning with completed checklist."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        checklist = supply_kit.return_checklist or []
        if not checklist or not all(item.get("checked") for item in checklist):
            return Response(
                {"detail": "All checklist items must be checked before warehouse confirmation."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        supply_kit.status = SupplyKitStatus.DEVUELTA
        supply_kit.warehouse_confirmed_at = timezone.now()
        supply_kit.save(update_fields=["status", "warehouse_confirmed_at", "modified"])
        sync_kit_tags_status(
            supply_kit,
            status=RFIDTagStatus.EN_STOCK,
            location="Almacén Central",
        )
        return Response(self._serialized(supply_kit))


class MedicalDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role(("medical_kits", "instrumental_control"))]

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

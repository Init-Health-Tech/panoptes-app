from decimal import Decimal

from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from instrumental.models import (
    DispatchStatus,
    FulfillmentPlan,
    FulfillmentStatus,
    HandheldScanEvent,
    HospitalSite,
    InstrumentCatalogItem,
    InstrumentPriceContract,
    InstrumentProcedureRequest,
    InstrumentQuotation,
    MaterialDispatch,
    ProximityScheduleLink,
    QuotationLine,
    QuotationStatus,
    RequestStatus,
    SterilizationStatus,
    TransportVehicle,
)
from instrumental.serializers import (
    FulfillmentPlanCreateSerializer,
    FulfillmentPlanSerializer,
    HandheldScanEventSerializer,
    HandheldScanSerializer,
    HospitalSiteSerializer,
    InstrumentCatalogItemSerializer,
    InstrumentalDashboardStatsSerializer,
    InstrumentPriceContractSerializer,
    InstrumentProcedureRequestSerializer,
    InstrumentQuotationSerializer,
    MaterialDispatchSerializer,
    ProximityScheduleLinkSerializer,
    TransportVehicleSerializer,
)
from instrumental.services import process_handheld_scan, resolve_catalog_unit_price, unload_material_dispatch
from organizations.mixins import OrganizationViewSetMixin
from organizations.models import OrganizationRole
from organizations.permissions import has_module_and_role


class OrganizationSerializerContextMixin:
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self.get_organization()
        return context


INSTRUMENTAL_ROLES = OrganizationRole.all_values()
DOCTOR_ACCEPT_ROLES = [OrganizationRole.ADMIN, OrganizationRole.DOCTOR]


class HospitalSiteViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = HospitalSite.objects.all()
    serializer_class = HospitalSiteSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control", INSTRUMENTAL_ROLES)]


class InstrumentCatalogViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = InstrumentCatalogItem.objects.select_related("rfid_tag")
    serializer_class = InstrumentCatalogItemSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control", INSTRUMENTAL_ROLES)]

    def get_queryset(self):
        queryset = super().get_queryset()
        if item_type := self.request.query_params.get("item_type"):
            queryset = queryset.filter(item_type=item_type)
        if category := self.request.query_params.get("category"):
            queryset = queryset.filter(category__icontains=category)
        if self.request.query_params.get("is_active") == "true":
            queryset = queryset.filter(is_active=True)
        elif self.request.query_params.get("is_active") == "false":
            queryset = queryset.filter(is_active=False)
        return queryset


class TransportVehicleViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = TransportVehicle.objects.select_related("rfid_tag")
    serializer_class = TransportVehicleSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control", INSTRUMENTAL_ROLES)]


class InstrumentPriceContractViewSet(
    OrganizationSerializerContextMixin,
    OrganizationViewSetMixin,
    viewsets.ModelViewSet,
):
    queryset = InstrumentPriceContract.objects.select_related("doctor", "hospital").prefetch_related(
        "lines__catalog_item",
    )
    serializer_class = InstrumentPriceContractSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control", INSTRUMENTAL_ROLES)]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.query_params.get("active") == "true":
            queryset = queryset.filter(is_active=True)
        if doctor := self.request.query_params.get("doctor"):
            queryset = queryset.filter(doctor_id=doctor)
        if hospital := self.request.query_params.get("hospital"):
            queryset = queryset.filter(hospital_id=hospital)
        return queryset


class InstrumentProcedureRequestViewSet(
    OrganizationSerializerContextMixin,
    OrganizationViewSetMixin,
    viewsets.ModelViewSet,
):
    queryset = InstrumentProcedureRequest.objects.select_related(
        "procedure",
        "doctor",
        "destination_hospital",
        "quotation",
        "fulfillment_plan",
    ).prefetch_related("lines__catalog_item")
    serializer_class = InstrumentProcedureRequestSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control", INSTRUMENTAL_ROLES)]

    def get_queryset(self):
        queryset = super().get_queryset()
        if status_param := self.request.query_params.get("status"):
            queryset = queryset.filter(status=status_param)
        if search := (self.request.query_params.get("search") or "").strip():
            filters = (
                Q(procedure__procedure_type__icontains=search)
                | Q(doctor__name__icontains=search)
                | Q(destination_hospital__name__icontains=search)
                | Q(notes__icontains=search)
                | Q(status__icontains=search)
            )
            if search.isdigit():
                filters |= Q(pk=int(search))
            queryset = queryset.filter(filters)
        return queryset

    @extend_schema(request=None, responses=InstrumentQuotationSerializer)
    @action(detail=True, methods=["post"], url_path="create-quotation")
    def create_quotation(self, request, pk=None):
        inst_request = self.get_object()
        organization = self.get_organization()

        if inst_request.status not in (RequestStatus.SUBMITTED, RequestStatus.QUOTATION):
            return Response(
                {"detail": "Request must be submitted before creating a quotation."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not inst_request.lines.exists():
            return Response({"detail": "Request has no lines."}, status=status.HTTP_400_BAD_REQUEST)

        quotation, created = InstrumentQuotation.objects.get_or_create(
            organization=organization,
            request=inst_request,
            defaults={"status": QuotationStatus.DRAFT},
        )
        if not created:
            quotation.lines.all().delete()

        subtotal = Decimal("0.00")
        applied_contract = None
        for line in inst_request.lines.select_related("catalog_item"):
            unit_price, price_source, contract = resolve_catalog_unit_price(
                organization,
                line.catalog_item,
                doctor=inst_request.doctor,
                hospital=inst_request.destination_hospital,
            )
            if contract and applied_contract is None:
                applied_contract = contract
            QuotationLine.objects.create(
                organization=organization,
                quotation=quotation,
                catalog_item=line.catalog_item,
                quantity=line.quantity,
                unit_price=unit_price,
                requires_sterilization=line.catalog_item.requires_sterilization,
                price_source=price_source,
                applied_contract=contract,
            )
            subtotal += unit_price * line.quantity

        quotation.subtotal = subtotal
        quotation.applied_contract = applied_contract
        quotation.status = QuotationStatus.PENDING_DOCTOR
        quotation.sent_at = timezone.now()
        quotation.save()

        inst_request.status = RequestStatus.QUOTATION
        inst_request.save(update_fields=["status", "modified"])

        return Response(InstrumentQuotationSerializer(quotation).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=InstrumentQuotationSerializer)
    @action(
        detail=True,
        methods=["post"],
        url_path="accept-quotation",
        permission_classes=[IsAuthenticated, has_module_and_role("instrumental_control", DOCTOR_ACCEPT_ROLES)],
    )
    def accept_quotation(self, request, pk=None):
        inst_request = self.get_object()
        if not hasattr(inst_request, "quotation"):
            return Response({"detail": "No quotation exists."}, status=status.HTTP_400_BAD_REQUEST)

        quotation = inst_request.quotation
        if quotation.status != QuotationStatus.PENDING_DOCTOR:
            return Response({"detail": "Quotation is not pending doctor approval."}, status=status.HTTP_400_BAD_REQUEST)

        quotation.status = QuotationStatus.ACCEPTED
        quotation.doctor_responded_at = timezone.now()
        quotation.save()

        inst_request.status = RequestStatus.QUOTATION_ACCEPTED
        inst_request.save(update_fields=["status", "modified"])

        return Response(InstrumentQuotationSerializer(quotation).data)

    @extend_schema(request=FulfillmentPlanCreateSerializer, responses=FulfillmentPlanSerializer)
    @action(detail=True, methods=["post"], url_path="plan-fulfillment")
    def plan_fulfillment(self, request, pk=None):
        inst_request = self.get_object()
        organization = self.get_organization()

        if inst_request.status != RequestStatus.QUOTATION_ACCEPTED:
            return Response(
                {"detail": "Quotation must be accepted before planning fulfillment."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if hasattr(inst_request, "fulfillment_plan"):
            return Response(
                {"detail": "Fulfillment plan already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = FulfillmentPlanCreateSerializer(
            data=request.data,
            context={"organization": organization},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        quotation = inst_request.quotation
        rfid_tags = [
            line.catalog_item.rfid_tag
            for line in quotation.lines.select_related("catalog_item__rfid_tag")
            if line.catalog_item.rfid_tag_id
        ]
        try:
            from inventory.custody import CustodyError, assert_tags_available

            assert_tags_available(rfid_tags)
        except CustodyError as exc:
            return Response(exc.as_response_data(), status=status.HTTP_400_BAD_REQUEST)

        plan = FulfillmentPlan.objects.create(
            organization=organization,
            request=inst_request,
            vehicle=data["vehicle"],
            lead_technician=data["lead_technician"],
            scheduled_departure=data.get("scheduled_departure"),
            scheduled_return=data.get("scheduled_return"),
            notes=data.get("notes", ""),
            status=FulfillmentStatus.PLANNING,
        )

        for qline in quotation.lines.select_related("catalog_item"):
            catalog = qline.catalog_item
            steril = SterilizationStatus.NOT_REQUIRED
            if qline.requires_sterilization:
                steril = SterilizationStatus.PENDING
            # One physical unit per requested quantity (RFID only on first unit of a tagged item).
            for unit_index in range(max(1, qline.quantity)):
                MaterialDispatch.objects.create(
                    organization=organization,
                    fulfillment=plan,
                    catalog_item=catalog,
                    technician=data["lead_technician"],
                    rfid_tag=catalog.rfid_tag if unit_index == 0 else None,
                    sku=catalog.sku,
                    requires_sterilization=qline.requires_sterilization,
                    sterilization_status=steril,
                    status=DispatchStatus.ASSIGNED,
                )

        plan.status = FulfillmentStatus.READY
        plan.save(update_fields=["status", "modified"])

        inst_request.status = RequestStatus.FULFILLMENT
        inst_request.save(update_fields=["status", "modified"])

        plan = FulfillmentPlan.objects.prefetch_related("dispatches__catalog_item", "dispatches__technician").get(
            pk=plan.pk,
        )
        return Response(FulfillmentPlanSerializer(plan).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=InstrumentProcedureRequestSerializer)
    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        inst_request = self.get_object()
        if inst_request.status != RequestStatus.DRAFT:
            return Response({"detail": "Only draft requests can be submitted."}, status=status.HTTP_400_BAD_REQUEST)
        if not inst_request.lines.exists():
            return Response({"detail": "Add at least one line."}, status=status.HTTP_400_BAD_REQUEST)
        inst_request.status = RequestStatus.SUBMITTED
        inst_request.save(update_fields=["status", "modified"])
        return Response(InstrumentProcedureRequestSerializer(inst_request, context=self.get_serializer_context()).data)


class InstrumentQuotationViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = InstrumentQuotation.objects.select_related(
        "request__procedure",
        "request__doctor",
        "request__destination_hospital",
        "applied_contract",
    ).prefetch_related("lines__catalog_item", "lines__applied_contract")
    serializer_class = InstrumentQuotationSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control", INSTRUMENTAL_ROLES)]

    def get_queryset(self):
        queryset = super().get_queryset()
        if status_param := self.request.query_params.get("status"):
            queryset = queryset.filter(status=status_param)
        return queryset


class FulfillmentPlanViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = FulfillmentPlan.objects.select_related(
        "request__procedure",
        "vehicle",
        "lead_technician",
    ).prefetch_related("dispatches__catalog_item", "dispatches__technician", "dispatches__rfid_tag")
    serializer_class = FulfillmentPlanSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control", INSTRUMENTAL_ROLES)]


class MaterialDispatchViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MaterialDispatch.objects.select_related(
        "catalog_item",
        "technician",
        "rfid_tag",
        "current_hospital",
        "fulfillment__request",
    )
    serializer_class = MaterialDispatchSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control", INSTRUMENTAL_ROLES)]

    def get_queryset(self):
        queryset = super().get_queryset()
        if status_param := self.request.query_params.get("status"):
            queryset = queryset.filter(status=status_param)
        return queryset

    @extend_schema(request=None, responses=MaterialDispatchSerializer)
    @action(detail=True, methods=["post"], url_path="unload")
    def unload(self, request, pk=None):
        dispatch = self.get_object()
        try:
            unload_material_dispatch(dispatch)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        dispatch.refresh_from_db()
        return Response(MaterialDispatchSerializer(dispatch).data)


class ProximityScheduleLinkViewSet(OrganizationSerializerContextMixin, OrganizationViewSetMixin, viewsets.ModelViewSet):
    queryset = ProximityScheduleLink.objects.select_related("from_request", "to_request", "reuse_dispatch")
    serializer_class = ProximityScheduleLinkSerializer
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control", INSTRUMENTAL_ROLES)]


class HandheldScanView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control", INSTRUMENTAL_ROLES)]

    @extend_schema(request=HandheldScanSerializer, responses=HandheldScanEventSerializer)
    def post(self, request):
        organization = request.organization
        serializer = HandheldScanSerializer(data=request.data, context={"organization": organization})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            scan, dispatch = process_handheld_scan(
                organization,
                identifier=data["identifier"],
                event_type=data["event_type"],
                hospital=data.get("hospital"),
                handheld_id=data.get("handheld_id", ""),
                location_notes=data.get("location_notes", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = HandheldScanEventSerializer(scan).data
        payload["dispatch_status"] = dispatch.status
        payload["tracking_identifier"] = dispatch.tracking_identifier
        return Response(payload, status=status.HTTP_201_CREATED)


class InstrumentalDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control", INSTRUMENTAL_ROLES)]

    @extend_schema(responses=InstrumentalDashboardStatsSerializer)
    def get(self, request):
        organization = request.organization
        requests_qs = InstrumentProcedureRequest.objects.for_organization(organization)
        quotations_qs = InstrumentQuotation.objects.for_organization(organization)
        fulfillments_qs = FulfillmentPlan.objects.for_organization(organization)
        dispatches_qs = MaterialDispatch.objects.for_organization(organization)

        payload = {
            "open_requests": requests_qs.exclude(
                status__in=[RequestStatus.COMPLETED, RequestStatus.CANCELLED, RequestStatus.VALIDATED],
            ).count(),
            "pending_quotations": quotations_qs.filter(status=QuotationStatus.PENDING_DOCTOR).count(),
            "active_fulfillments": fulfillments_qs.exclude(
                status__in=[FulfillmentStatus.VALIDATED],
            ).count(),
            "materials_in_field": dispatches_qs.filter(status=DispatchStatus.AT_HOSPITAL).count(),
            "materials_returning": dispatches_qs.filter(status=DispatchStatus.RETURNING).count(),
        }
        return Response(payload)

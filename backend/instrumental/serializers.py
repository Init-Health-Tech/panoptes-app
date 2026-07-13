from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from instrumental.models import (
    FulfillmentPlan,
    HandheldEventType,
    HandheldScanEvent,
    HospitalSite,
    InstrumentCatalogItem,
    InstrumentContractLine,
    InstrumentPriceContract,
    InstrumentProcedureRequest,
    InstrumentQuotation,
    InstrumentRequestLine,
    MaterialDispatch,
    ProximityScheduleLink,
    QuotationLine,
    QuotationStatus,
    RequestStatus,
    SterilizationStatus,
    TransportVehicle,
)


def _validate_same_org(obj, organization, label):
    if obj.organization_id != organization.id:
        raise serializers.ValidationError(f"{label} must belong to your organization.")


class HospitalSiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = HospitalSite
        fields = ["id", "name", "code", "is_central", "city", "is_active", "created", "modified"]


class InstrumentCatalogItemSerializer(serializers.ModelSerializer):
    rfid_code = serializers.CharField(source="rfid_tag.code", read_only=True)

    class Meta:
        model = InstrumentCatalogItem
        fields = [
            "id",
            "sku",
            "name",
            "item_type",
            "description",
            "requires_sterilization",
            "default_unit_price",
            "rfid_tag",
            "rfid_code",
            "is_active",
            "created",
            "modified",
        ]

    def validate_rfid_tag(self, tag):
        if tag:
            _validate_same_org(tag, self.context["organization"], "RFID tag")
        return tag


class InstrumentContractLineSerializer(serializers.ModelSerializer):
    catalog_sku = serializers.CharField(source="catalog_item.sku", read_only=True)
    catalog_name = serializers.CharField(source="catalog_item.name", read_only=True)
    catalog_item_type = serializers.CharField(source="catalog_item.item_type", read_only=True)

    class Meta:
        model = InstrumentContractLine
        fields = [
            "id",
            "catalog_item",
            "catalog_sku",
            "catalog_name",
            "catalog_item_type",
            "unit_price",
        ]

    def validate_catalog_item(self, item):
        _validate_same_org(item, self.context["organization"], "Catalog item")
        return item


class InstrumentPriceContractSerializer(serializers.ModelSerializer):
    lines = InstrumentContractLineSerializer(many=True, required=False)
    doctor_name = serializers.CharField(source="doctor.name", read_only=True, allow_null=True)
    hospital_name = serializers.CharField(source="hospital.name", read_only=True, allow_null=True)
    scope_label = serializers.CharField(read_only=True)

    class Meta:
        model = InstrumentPriceContract
        fields = [
            "id",
            "name",
            "doctor",
            "doctor_name",
            "hospital",
            "hospital_name",
            "scope_label",
            "valid_from",
            "valid_to",
            "is_active",
            "notes",
            "lines",
            "created",
            "modified",
        ]

    def validate(self, attrs):
        doctor = attrs.get("doctor", getattr(self.instance, "doctor", None))
        hospital = attrs.get("hospital", getattr(self.instance, "hospital", None))
        if not doctor and not hospital:
            raise serializers.ValidationError("Indica doctor, hospital o ambos.")
        return attrs

    def validate_doctor(self, doctor):
        if doctor:
            _validate_same_org(doctor, self.context["organization"], "Doctor")
        return doctor

    def validate_hospital(self, hospital):
        if hospital:
            _validate_same_org(hospital, self.context["organization"], "Hospital")
        return hospital

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        organization = validated_data.pop("organization", self.context["organization"])
        contract = InstrumentPriceContract.objects.create(organization=organization, **validated_data)
        for line_data in lines_data:
            InstrumentContractLine.objects.create(organization=organization, contract=contract, **line_data)
        return contract

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            organization = self.context["organization"]
            instance.lines.all().delete()
            for line_data in lines_data:
                InstrumentContractLine.objects.create(
                    organization=organization,
                    contract=instance,
                    **line_data,
                )
        return instance


class TransportVehicleSerializer(serializers.ModelSerializer):
    rfid_code = serializers.CharField(source="rfid_tag.code", read_only=True)

    class Meta:
        model = TransportVehicle
        fields = [
            "id",
            "code",
            "plate",
            "name",
            "transporter_name",
            "rfid_tag",
            "rfid_code",
            "is_active",
            "created",
            "modified",
        ]

    def validate_rfid_tag(self, tag):
        if tag:
            _validate_same_org(tag, self.context["organization"], "RFID tag")
        return tag


class InstrumentRequestLineSerializer(serializers.ModelSerializer):
    catalog_sku = serializers.CharField(source="catalog_item.sku", read_only=True)
    catalog_name = serializers.CharField(source="catalog_item.name", read_only=True)

    class Meta:
        model = InstrumentRequestLine
        fields = ["id", "catalog_item", "catalog_sku", "catalog_name", "quantity", "notes"]

    def validate_catalog_item(self, item):
        _validate_same_org(item, self.context["organization"], "Catalog item")
        return item


class InstrumentProcedureRequestSerializer(serializers.ModelSerializer):
    lines = InstrumentRequestLineSerializer(many=True, required=False)
    procedure_type = serializers.CharField(source="procedure.procedure_type", read_only=True)
    doctor_name = serializers.CharField(source="doctor.name", read_only=True)
    destination_hospital_name = serializers.CharField(source="destination_hospital.name", read_only=True)
    quotation_status = serializers.SerializerMethodField()
    fulfillment_status = serializers.SerializerMethodField()

    class Meta:
        model = InstrumentProcedureRequest
        fields = [
            "id",
            "procedure",
            "procedure_type",
            "doctor",
            "doctor_name",
            "destination_hospital",
            "destination_hospital_name",
            "status",
            "notes",
            "scheduled_start",
            "scheduled_end",
            "estimated_out_hours",
            "proximity_next_request",
            "lines",
            "quotation_status",
            "fulfillment_status",
            "created",
            "modified",
        ]

    def get_quotation_status(self, obj):
        if hasattr(obj, "quotation"):
            return obj.quotation.status
        return None

    def get_fulfillment_status(self, obj):
        if hasattr(obj, "fulfillment_plan"):
            return obj.fulfillment_plan.status
        return None

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        organization = validated_data.pop("organization", self.context["organization"])
        request = InstrumentProcedureRequest.objects.create(organization=organization, **validated_data)
        for line_data in lines_data:
            InstrumentRequestLine.objects.create(organization=organization, request=request, **line_data)
        return request

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            organization = self.context["organization"]
            instance.lines.all().delete()
            for line_data in lines_data:
                InstrumentRequestLine.objects.create(organization=organization, request=instance, **line_data)
        return instance

    def validate_procedure(self, procedure):
        _validate_same_org(procedure, self.context["organization"], "Procedure")
        return procedure

    def validate_doctor(self, doctor):
        _validate_same_org(doctor, self.context["organization"], "Doctor")
        return doctor

    def validate_destination_hospital(self, hospital):
        _validate_same_org(hospital, self.context["organization"], "Hospital")
        return hospital


class QuotationLineSerializer(serializers.ModelSerializer):
    catalog_sku = serializers.CharField(source="catalog_item.sku", read_only=True)
    catalog_name = serializers.CharField(source="catalog_item.name", read_only=True)
    line_total = serializers.SerializerMethodField()
    applied_contract_name = serializers.CharField(
        source="applied_contract.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = QuotationLine
        fields = [
            "id",
            "catalog_item",
            "catalog_sku",
            "catalog_name",
            "quantity",
            "unit_price",
            "requires_sterilization",
            "line_total",
            "price_source",
            "applied_contract",
            "applied_contract_name",
        ]

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2))
    def get_line_total(self, obj):
        return obj.line_total


class InstrumentQuotationSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True, read_only=True)
    request_status = serializers.CharField(source="request.status", read_only=True)
    procedure_type = serializers.CharField(source="request.procedure.procedure_type", read_only=True)
    doctor_name = serializers.CharField(source="request.doctor.name", read_only=True)
    hospital_name = serializers.CharField(source="request.destination_hospital.name", read_only=True)
    applied_contract_name = serializers.CharField(
        source="applied_contract.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = InstrumentQuotation
        fields = [
            "id",
            "request",
            "status",
            "subtotal",
            "notes",
            "sent_at",
            "doctor_responded_at",
            "lines",
            "request_status",
            "procedure_type",
            "doctor_name",
            "hospital_name",
            "applied_contract",
            "applied_contract_name",
            "created",
            "modified",
        ]


class MaterialDispatchSerializer(serializers.ModelSerializer):
    catalog_sku = serializers.CharField(source="catalog_item.sku", read_only=True)
    catalog_name = serializers.CharField(source="catalog_item.name", read_only=True)
    technician_name = serializers.CharField(source="technician.name", read_only=True)
    tracking_identifier = serializers.CharField(read_only=True)
    rfid_code = serializers.CharField(source="rfid_tag.code", read_only=True)

    class Meta:
        model = MaterialDispatch
        fields = [
            "id",
            "catalog_item",
            "catalog_sku",
            "catalog_name",
            "technician",
            "technician_name",
            "tray_code",
            "rfid_tag",
            "rfid_code",
            "sku",
            "tracking_identifier",
            "requires_sterilization",
            "sterilization_status",
            "status",
            "current_hospital",
            "loaded_at",
            "returned_at",
            "created",
            "modified",
        ]


class FulfillmentPlanSerializer(serializers.ModelSerializer):
    dispatches = MaterialDispatchSerializer(many=True, read_only=True)
    vehicle_code = serializers.CharField(source="vehicle.code", read_only=True)
    technician_name = serializers.CharField(source="lead_technician.name", read_only=True)
    procedure_type = serializers.CharField(source="request.procedure.procedure_type", read_only=True)

    class Meta:
        model = FulfillmentPlan
        fields = [
            "id",
            "request",
            "vehicle",
            "vehicle_code",
            "lead_technician",
            "technician_name",
            "status",
            "scheduled_departure",
            "scheduled_return",
            "notes",
            "dispatches",
            "procedure_type",
            "created",
            "modified",
        ]


class FulfillmentPlanCreateSerializer(serializers.Serializer):
    vehicle = serializers.PrimaryKeyRelatedField(queryset=TransportVehicle.objects.all())
    lead_technician = serializers.PrimaryKeyRelatedField(queryset=TransportVehicle.objects.none())
    scheduled_departure = serializers.DateTimeField(required=False, allow_null=True)
    scheduled_return = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        organization = self.context.get("organization")
        if organization:
            from medical.models import Technician

            self.fields["lead_technician"].queryset = Technician.objects.filter(organization=organization)
            self.fields["vehicle"].queryset = TransportVehicle.objects.filter(organization=organization)

    def validate_vehicle(self, vehicle):
        _validate_same_org(vehicle, self.context["organization"], "Vehicle")
        return vehicle

    def validate_lead_technician(self, technician):
        _validate_same_org(technician, self.context["organization"], "Technician")
        return technician


class HandheldScanSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=128)
    event_type = serializers.ChoiceField(choices=HandheldEventType.choices)
    hospital = serializers.PrimaryKeyRelatedField(
        queryset=HospitalSite.objects.all(),
        required=False,
        allow_null=True,
    )
    handheld_id = serializers.CharField(max_length=64, required=False, allow_blank=True)
    location_notes = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        organization = self.context.get("organization")
        if organization:
            self.fields["hospital"].queryset = HospitalSite.objects.filter(organization=organization)

    def validate_hospital(self, hospital):
        if hospital:
            _validate_same_org(hospital, self.context["organization"], "Hospital")
        return hospital


class HandheldScanEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = HandheldScanEvent
        fields = [
            "id",
            "material_dispatch",
            "identifier_used",
            "event_type",
            "hospital",
            "handheld_id",
            "location_notes",
            "scanned_at",
        ]


class ProximityScheduleLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProximityScheduleLink
        fields = ["id", "from_request", "to_request", "reuse_dispatch", "minutes_between", "notes", "created"]


class InstrumentalDashboardStatsSerializer(serializers.Serializer):
    open_requests = serializers.IntegerField()
    pending_quotations = serializers.IntegerField()
    active_fulfillments = serializers.IntegerField()
    materials_in_field = serializers.IntegerField()
    materials_returning = serializers.IntegerField()

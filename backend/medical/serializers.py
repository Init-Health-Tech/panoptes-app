from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from inventory.models import RFIDTag
from medical.models import (
    Doctor,
    Procedure,
    ProcedureAssignment,
    SupplyKit,
    Technician,
)


class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = [  # noqa: RUF012
            "id",
            "name",
            "specialty",
            "hospital",
            "is_active",
            "created",
            "modified",
        ]


class TechnicianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Technician
        fields = [  # noqa: RUF012
            "id",
            "name",
            "is_active",
            "created",
            "modified",
        ]


class ProcedureSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source="doctor.name", read_only=True, allow_null=True)

    class Meta:
        model = Procedure
        fields = [  # noqa: RUF012
            "id",
            "procedure_type",
            "destination_hospital",
            "scheduled_date",
            "doctor",
            "doctor_name",
            "status",
            "created",
            "modified",
        ]

    def validate_doctor(self, doctor):
        organization = self.context["organization"]
        if doctor and doctor.organization_id != organization.id:
            raise serializers.ValidationError("Doctor must belong to your organization.")
        return doctor


class ProcedureAssignmentSerializer(serializers.ModelSerializer):
    procedure_type = serializers.CharField(source="procedure.procedure_type", read_only=True)
    technician_name = serializers.CharField(source="technician.name", read_only=True)
    doctor_name = serializers.CharField(source="doctor.name", read_only=True)

    class Meta:
        model = ProcedureAssignment
        fields = [  # noqa: RUF012
            "id",
            "procedure",
            "procedure_type",
            "technician",
            "technician_name",
            "doctor",
            "doctor_name",
            "role",
            "created",
            "modified",
        ]

    def validate(self, attrs):
        organization = self.context["organization"]
        procedure = attrs.get("procedure") or getattr(self.instance, "procedure", None)
        technician = attrs.get("technician") or getattr(self.instance, "technician", None)
        doctor = attrs.get("doctor") or getattr(self.instance, "doctor", None)

        for obj in (procedure, technician, doctor):
            if obj and obj.organization_id != organization.id:
                raise serializers.ValidationError("Related entities must belong to your organization.")
        return attrs


class SupplyKitTagDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    code = serializers.CharField()
    item_type = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    last_location = serializers.CharField(allow_blank=True)


class ReturnChecklistItemSerializer(serializers.Serializer):
    code = serializers.CharField()
    item_type = serializers.CharField(required=False, allow_blank=True)
    checked = serializers.BooleanField()


class SupplyKitSerializer(serializers.ModelSerializer):
    tag_codes = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    tag_count = serializers.SerializerMethodField()
    procedure_type = serializers.CharField(source="procedure.procedure_type", read_only=True, allow_null=True)
    procedure_doctor_name = serializers.CharField(
        source="procedure.doctor.name",
        read_only=True,
        allow_null=True,
    )
    assigned_technician_name = serializers.CharField(
        source="assigned_technician.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = SupplyKit
        fields = [  # noqa: RUF012
            "id",
            "name",
            "code",
            "procedure",
            "procedure_type",
            "procedure_doctor_name",
            "status",
            "destination_hospital",
            "shipped_at",
            "assigned_technician",
            "assigned_technician_name",
            "transporter_name",
            "hospital_arrived_at",
            "return_checklist",
            "warehouse_confirmed_at",
            "tag_codes",
            "tags",
            "tag_count",
            "created",
            "modified",
        ]
        read_only_fields = [  # noqa: RUF012
            "shipped_at",
            "hospital_arrived_at",
            "warehouse_confirmed_at",
            "return_checklist",
        ]

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_tag_codes(self, obj):
        return list(obj.tags.values_list("code", flat=True))

    @extend_schema_field(SupplyKitTagDetailSerializer(many=True))
    def get_tags(self, obj):
        return [
            {
                "id": tag.id,
                "code": tag.code,
                "item_type": tag.item_type or "",
                "status": tag.status,
                "last_location": tag.last_location or "",
            }
            for tag in obj.tags.all()
        ]

    def get_tag_count(self, obj):
        return obj.tags.count()

    def validate_procedure(self, procedure):
        organization = self.context["organization"]
        if procedure and procedure.organization_id != organization.id:
            raise serializers.ValidationError("Procedure must belong to your organization.")
        return procedure

    def validate_assigned_technician(self, technician):
        organization = self.context["organization"]
        if technician and technician.organization_id != organization.id:
            raise serializers.ValidationError("Technician must belong to your organization.")
        return technician


class SupplyKitTagActionSerializer(serializers.Serializer):
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
    )

    def validate_tag_ids(self, tag_ids):
        organization = self.context["organization"]
        tags = RFIDTag.objects.filter(id__in=tag_ids, organization=organization)
        if tags.count() != len(set(tag_ids)):
            raise serializers.ValidationError("One or more tags are invalid for your organization.")
        return list(tags)


class SupplyKitDispatchSerializer(serializers.Serializer):
    transporter_name = serializers.CharField(max_length=255)
    assigned_technician = serializers.PrimaryKeyRelatedField(queryset=Technician.objects.all())

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        organization = self.context.get("organization")
        if organization:
            self.fields["assigned_technician"].queryset = Technician.objects.filter(
                organization=organization,
                is_active=True,
            )

    def validate_assigned_technician(self, technician):
        organization = self.context["organization"]
        if technician.organization_id != organization.id:
            raise serializers.ValidationError("Technician must belong to your organization.")
        return technician


class SupplyKitReturnChecklistSerializer(serializers.Serializer):
    items = ReturnChecklistItemSerializer(many=True)


class MedicalDashboardStatsSerializer(serializers.Serializer):
    kits_in_transit = serializers.IntegerField()
    kits_assembling = serializers.IntegerField()
    active_procedures = serializers.IntegerField()

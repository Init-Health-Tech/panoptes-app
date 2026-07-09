from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from inventory.models import RFIDTag
from medical.models import (
    AssignmentRole,
    Doctor,
    Procedure,
    ProcedureAssignment,
    ProcedureStatus,
    SupplyKit,
    SupplyKitStatus,
    SupplyKitTag,
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
    class Meta:
        model = Procedure
        fields = [  # noqa: RUF012
            "id",
            "procedure_type",
            "destination_hospital",
            "scheduled_date",
            "status",
            "created",
            "modified",
        ]


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


class SupplyKitSerializer(serializers.ModelSerializer):
    tag_codes = serializers.SerializerMethodField()
    tag_count = serializers.SerializerMethodField()

    class Meta:
        model = SupplyKit
        fields = [  # noqa: RUF012
            "id",
            "name",
            "code",
            "procedure",
            "status",
            "destination_hospital",
            "shipped_at",
            "tag_codes",
            "tag_count",
            "created",
            "modified",
        ]

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_tag_codes(self, obj):
        return list(obj.tags.values_list("code", flat=True))

    def get_tag_count(self, obj):
        return obj.tags.count()

    def validate_procedure(self, procedure):
        organization = self.context["organization"]
        if procedure and procedure.organization_id != organization.id:
            raise serializers.ValidationError("Procedure must belong to your organization.")
        return procedure


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


class MedicalDashboardStatsSerializer(serializers.Serializer):
    kits_in_transit = serializers.IntegerField()
    kits_assembling = serializers.IntegerField()
    active_procedures = serializers.IntegerField()

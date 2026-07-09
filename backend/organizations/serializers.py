from rest_framework import serializers

from organizations.models import Organization, OrganizationMembership


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [  # noqa: RUF012
            "id",
            "name",
            "slug",
            "industry_type",
            "is_active",
            "created",
            "modified",
        ]


class ActiveModulesSerializer(serializers.Serializer):
    modules = serializers.ListField(child=serializers.CharField())
    role = serializers.CharField(allow_null=True)
    organization = OrganizationSerializer(allow_null=True)


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = [  # noqa: RUF012
            "id",
            "organization",
            "role",
            "created",
            "modified",
        ]

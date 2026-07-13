from rest_framework import serializers

from organizations.models import (
    Organization,
    OrganizationMembership,
    OrganizationProduct,
    ProductPackage,
)


class OrganizationSerializer(serializers.ModelSerializer):
    is_demo_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Organization
        fields = [  # noqa: RUF012
            "id",
            "name",
            "slug",
            "industry_type",
            "account_type",
            "is_active",
            "contact_name",
            "contact_email",
            "notes",
            "demo_duration_days",
            "demo_expires_at",
            "demo_locked",
            "is_demo_expired",
            "created",
            "modified",
        ]
        read_only_fields = [  # noqa: RUF012
            "slug",
            "demo_expires_at",
            "demo_locked",
            "is_demo_expired",
            "created",
            "modified",
        ]


class PlatformOrganizationSerializer(OrganizationSerializer):
    active_modules = serializers.SerializerMethodField()
    packages = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta(OrganizationSerializer.Meta):
        fields = OrganizationSerializer.Meta.fields + [  # noqa: RUF012
            "active_modules",
            "packages",
            "member_count",
        ]

    def get_active_modules(self, obj):
        return list(
            obj.organization_modules.filter(is_active=True).values_list("module__code", flat=True)
        )

    def get_packages(self, obj):
        return list(
            obj.organization_products.filter(is_active=True).values_list("package__code", flat=True)
        )

    def get_member_count(self, obj):
        return obj.memberships.count()


class ProductPackageSerializer(serializers.ModelSerializer):
    modules = serializers.SerializerMethodField()

    class Meta:
        model = ProductPackage
        fields = ["id", "code", "name", "description", "is_public", "modules"]

    def get_modules(self, obj):
        return list(
            obj.package_modules.order_by("sort_order").values_list("module__code", flat=True)
        )


class ProvisionDemoSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    contact_email = serializers.EmailField()
    contact_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    duration_days = serializers.IntegerField(min_value=1, max_value=365, default=14)
    package_codes = serializers.ListField(
        child=serializers.SlugField(),
        required=False,
    )
    industry_type = serializers.ChoiceField(
        choices=["clinical", "logistics", "mixed"],
        default="clinical",
    )
    password = serializers.CharField(required=False, allow_blank=True, write_only=True)


class ExtendDemoSerializer(serializers.Serializer):
    extra_days = serializers.IntegerField(min_value=1, max_value=365, default=7)


class AssignPackageSerializer(serializers.Serializer):
    package_code = serializers.SlugField()
    adapted_notes = serializers.CharField(required=False, allow_blank=True, default="")


class ActiveModulesSerializer(serializers.Serializer):
    modules = serializers.ListField(child=serializers.CharField())
    role = serializers.CharField(allow_null=True)
    organization = OrganizationSerializer(allow_null=True)
    demo_expires_at = serializers.DateTimeField(allow_null=True, required=False)
    is_demo_expired = serializers.BooleanField(required=False)
    account_type = serializers.CharField(allow_null=True, required=False)
    is_platform_admin = serializers.BooleanField(required=False)


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


class OrganizationProductSerializer(serializers.ModelSerializer):
    package = ProductPackageSerializer(read_only=True)

    class Meta:
        model = OrganizationProduct
        fields = [  # noqa: RUF012
            "id",
            "package",
            "is_active",
            "adapted_notes",
            "config",
            "activated_at",
            "created",
            "modified",
        ]

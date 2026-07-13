from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import Organization, ProductPackage, UsageEvent
from organizations.platform_permissions import IsPlatformAdmin
from organizations.serializers import (
    AssignPackageSerializer,
    ExtendDemoSerializer,
    PlatformOrganizationSerializer,
    ProductPackageSerializer,
    ProvisionDemoSerializer,
)
from organizations.services_platform import (
    assign_package,
    extend_demo,
    provision_demo,
    purge_demo,
)


class PlatformOrganizationListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(responses=PlatformOrganizationSerializer(many=True))
    def get(self, request):
        qs = Organization.objects.all().prefetch_related(
            "organization_modules__module",
            "organization_products__package",
            "memberships",
        )
        account_type = request.query_params.get("account_type")
        if account_type:
            qs = qs.filter(account_type=account_type)
        return Response(PlatformOrganizationSerializer(qs, many=True).data)

    @extend_schema(request=ProvisionDemoSerializer, responses=PlatformOrganizationSerializer)
    def post(self, request):
        """Create + provision a demo client in one step."""
        serializer = ProvisionDemoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = provision_demo(
            name=data["name"],
            contact_email=data["contact_email"],
            contact_name=data.get("contact_name", ""),
            duration_days=data.get("duration_days", 14),
            package_codes=data.get("package_codes") or ["pkg_instrumental"],
            industry_type=data.get("industry_type", "clinical"),
            actor=request.user,
            password=data.get("password") or None,
        )
        org = result["organization"]
        payload = PlatformOrganizationSerializer(org).data
        payload["demo_credentials"] = {
            "email": result["user"].email,
            "password": result["password"],
            "demo_expires_at": result["demo_expires_at"],
        }
        return Response(payload, status=status.HTTP_201_CREATED)


class PlatformOrganizationDetailView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get_object(self, pk):
        return get_object_or_404(
            Organization.objects.prefetch_related(
                "organization_modules__module",
                "organization_products__package",
                "memberships",
            ),
            pk=pk,
        )

    @extend_schema(responses=PlatformOrganizationSerializer)
    def get(self, request, pk):
        return Response(PlatformOrganizationSerializer(self.get_object(pk)).data)


class PlatformPurgeDemoView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def post(self, request, pk):
        org = get_object_or_404(Organization, pk=pk)
        try:
            counts = purge_demo(org, actor=request.user, deactivate=True)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"ok": True, "counts": counts})


class PlatformExtendDemoView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def post(self, request, pk):
        org = get_object_or_404(Organization, pk=pk)
        serializer = ExtendDemoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            extend_demo(org, serializer.validated_data["extra_days"], actor=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PlatformOrganizationSerializer(org).data)


class PlatformAssignPackageView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def post(self, request, pk):
        org = get_object_or_404(Organization, pk=pk)
        serializer = AssignPackageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        package = get_object_or_404(ProductPackage, code=serializer.validated_data["package_code"])
        assign_package(
            org,
            package,
            actor=request.user,
            adapted_notes=serializer.validated_data.get("adapted_notes", ""),
        )
        return Response(PlatformOrganizationSerializer(org).data)


class PlatformPackageListView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request):
        qs = ProductPackage.objects.filter(is_public=True).prefetch_related("package_modules__module")
        return Response(ProductPackageSerializer(qs, many=True).data)


class PlatformUsageSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request):
        from django.db.models import Count
        from django.utils import timezone
        from datetime import timedelta

        since = timezone.now() - timedelta(days=7)
        by_org = (
            UsageEvent.objects.filter(created__gte=since)
            .values("organization_id", "organization__name", "organization__slug")
            .annotate(
                requests=Count("id"),
                users=Count("user_id", distinct=True),
                ips=Count("ip_address", distinct=True),
            )
            .order_by("-requests")[:50]
        )
        by_module = (
            UsageEvent.objects.filter(created__gte=since)
            .exclude(module_code="")
            .values("module_code")
            .annotate(requests=Count("id"))
            .order_by("-requests")
        )
        demos = Organization.objects.filter(account_type="demo").count()
        demos_expiring = Organization.objects.filter(
            account_type="demo",
            demo_expires_at__lte=timezone.now() + timedelta(days=3),
            demo_expires_at__gte=timezone.now(),
            is_active=True,
        ).count()
        return Response(
            {
                "window_days": 7,
                "demo_count": demos,
                "demos_expiring_soon": demos_expiring,
                "by_organization": list(by_org),
                "by_module": list(by_module),
            }
        )


class PlatformOrgUsageDetailView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request, pk):
        org = get_object_or_404(Organization, pk=pk)
        events = UsageEvent.objects.filter(organization=org).order_by("-created")[:100]
        from django.db.models import Count

        top_ips = (
            UsageEvent.objects.filter(organization=org)
            .exclude(ip_address=None)
            .values("ip_address")
            .annotate(requests=Count("id"))
            .order_by("-requests")[:20]
        )
        return Response(
            {
                "organization": PlatformOrganizationSerializer(org).data,
                "top_ips": list(top_ips),
                "recent_events": [
                    {
                        "path": e.path,
                        "method": e.method,
                        "ip_address": e.ip_address,
                        "module_code": e.module_code,
                        "user": e.user.email if e.user_id else None,
                        "created": e.created,
                    }
                    for e in events
                ],
            }
        )

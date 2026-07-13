from urllib.parse import quote

from django.db.models import Count
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.permissions import has_module_and_role_for_view
from organizations.serializers import ActiveModulesSerializer
from organizations.utils import get_user_organization


SALES_EMAIL = "sales@init.com.mx"


class ActiveModulesView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=ActiveModulesSerializer)
    def get(self, request):
        membership = get_user_organization(request.user)
        if membership is None:
            payload = {
                "modules": [],
                "role": None,
                "organization": None,
                "demo_expires_at": None,
                "is_demo_expired": False,
                "account_type": None,
                "is_platform_admin": bool(
                    request.user.is_superuser or getattr(request.user, "is_platform_admin", False)
                ),
            }
            return Response(payload)

        organization = membership.organization
        module_codes = list(
            organization.organization_modules.filter(is_active=True).values_list(
                "module__code",
                flat=True,
            )
        )
        payload = {
            "modules": module_codes,
            "role": membership.role,
            "organization": organization,
            "demo_expires_at": organization.demo_expires_at,
            "is_demo_expired": organization.is_demo_expired,
            "account_type": organization.account_type,
            "is_platform_admin": bool(
                request.user.is_superuser or getattr(request.user, "is_platform_admin", False)
            ),
        }
        serializer = ActiveModulesSerializer(payload)
        return Response(serializer.data)


class ModuleProbeView(APIView):
    """Verify that the caller's organization has a module enabled."""

    permission_classes = [IsAuthenticated, has_module_and_role_for_view("module_code")]

    @extend_schema(responses={200: {"type": "object", "properties": {"module": {"type": "string"}}}})
    def get(self, request, module_code):
        return Response({"module": module_code, "status": "active"})


class DemoRequestLicenseView(APIView):
    """Return a prefilled mailto for sales when demo expires (or nears expiry)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = get_user_organization(request.user)
        org = membership.organization if membership else None
        org_name = org.name if org else "Cliente Panoptes"
        subject = quote(f"Solicitud versión completa Panoptes — {org_name}")
        body = quote(
            "Hola equipo comercial INIT,\n\n"
            f"Somos {org_name} y terminamos / estamos por terminar nuestra demo de Panoptes.\n"
            "Nos interesa la versión completa para nuestro sistema.\n\n"
            f"Contacto: {request.user.email}\n"
            "Gracias."
        )
        return Response(
            {
                "sales_email": SALES_EMAIL,
                "mailto": f"mailto:{SALES_EMAIL}?subject={subject}&body={body}",
                "organization": org.name if org else None,
                "is_demo_expired": bool(org and org.is_demo_expired),
            }
        )


class DashboardChartsView(APIView):
    """Tenant dashboard chart series (inventory + instrumental funnel)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = get_user_organization(request.user)
        if membership is None:
            return Response({"inventory": None, "instrumental_funnel": None})

        org = membership.organization
        inventory = None
        funnel = None

        try:
            from inventory.models import RFIDTag

            rows = (
                RFIDTag.objects.filter(organization=org)
                .values("status")
                .annotate(count=Count("id"))
                .order_by()
            )
            inventory = {
                "labels": [r["status"] for r in rows],
                "values": [r["count"] for r in rows],
                "total": sum(r["count"] for r in rows),
            }
        except Exception:  # noqa: BLE001
            inventory = None

        try:
            from instrumental.models import InstrumentProcedureRequest

            status_order = [
                "draft",
                "submitted",
                "quotation",
                "quotation_accepted",
                "fulfillment",
                "in_field",
                "returning",
                "validated",
                "completed",
            ]
            counts = {
                row["status"]: row["count"]
                for row in InstrumentProcedureRequest.objects.filter(organization=org)
                .values("status")
                .annotate(count=Count("id"))
            }
            funnel = {
                "labels": status_order,
                "values": [counts.get(s, 0) for s in status_order],
                "total": sum(counts.values()),
            }
        except Exception:  # noqa: BLE001
            funnel = None

        return Response({"inventory": inventory, "instrumental_funnel": funnel})

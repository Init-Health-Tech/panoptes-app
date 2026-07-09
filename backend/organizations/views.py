from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.permissions import has_module_and_role_for_view
from organizations.serializers import ActiveModulesSerializer
from organizations.utils import get_user_organization


class ActiveModulesView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=ActiveModulesSerializer)
    def get(self, request):
        membership = get_user_organization(request.user)
        if membership is None:
            payload = {"modules": [], "role": None, "organization": None}
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
        }
        serializer = ActiveModulesSerializer(payload)
        return Response(serializer.data)


class ModuleProbeView(APIView):
    """Verify that the caller's organization has a module enabled."""

    permission_classes = [IsAuthenticated, has_module_and_role_for_view("module_code")]

    @extend_schema(responses={200: {"type": "object", "properties": {"module": {"type": "string"}}}})
    def get(self, request, module_code):
        return Response({"module": module_code, "status": "active"})

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.excel_io import workbook_response
from inventory.apps import InventoryConfig
from inventory.bulk_import import (
    catalog_template,
    import_catalog_items,
    import_inventory_locations,
    import_inventory_tags,
    inventory_template,
    location_template,
)
from organizations.permissions import has_module_and_role


class InventoryImportTemplateView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role(InventoryConfig.module_code)]

    @extend_schema(responses={200: bytes})
    def get(self, request):
        return workbook_response(inventory_template(), "plantilla_inventario_rfid.xlsx")


class InventoryImportView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role(InventoryConfig.module_code)]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(responses={200: dict})
    def post(self, request):
        org = getattr(request, "organization", None)
        if org is None:
            return Response({"detail": "Sin organización."}, status=status.HTTP_403_FORBIDDEN)
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response(
                {"detail": "Adjunta un archivo Excel en el campo «file»."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(import_inventory_tags(org, uploaded))


class InventoryLocationImportTemplateView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role(InventoryConfig.module_code)]

    def get(self, request):
        return workbook_response(location_template(), "plantilla_ubicaciones.xlsx")


class InventoryLocationImportView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role(InventoryConfig.module_code)]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        org = getattr(request, "organization", None)
        if org is None:
            return Response({"detail": "Sin organización."}, status=status.HTTP_403_FORBIDDEN)
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response(
                {"detail": "Adjunta un archivo Excel en el campo «file»."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(import_inventory_locations(org, uploaded))


class InstrumentCatalogImportTemplateView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control")]

    def get(self, request):
        return workbook_response(catalog_template(), "plantilla_catalogo_productos.xlsx")


class InstrumentCatalogImportView(APIView):
    permission_classes = [IsAuthenticated, has_module_and_role("instrumental_control")]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        org = getattr(request, "organization", None)
        if org is None:
            return Response({"detail": "Sin organización."}, status=status.HTTP_403_FORBIDDEN)
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response(
                {"detail": "Adjunta un archivo Excel en el campo «file»."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(import_catalog_items(org, uploaded))

from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from openpyxl import Workbook
from rest_framework.test import APITestCase

from common.utils.tests import TestCaseUtils
from instrumental.models import CatalogItemType, InstrumentCatalogItem
from inventory.bulk_import import import_catalog_items, import_inventory_tags
from inventory.models import RFIDTag
from inventory.rfid_code import hex_to_ascii_epc
from model_bakery import baker
from organizations.models import (
    Module,
    Organization,
    OrganizationMembership,
    OrganizationModule,
    OrganizationRole,
)


def _xlsx_bytes(headers, rows):
    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


class BulkImportServiceTests(TestCase):
    def setUp(self):
        self.org = baker.make(Organization)

    def test_import_catalog_skips_duplicates(self):
        InstrumentCatalogItem.objects.create(
            organization=self.org,
            sku="SKU-1",
            name="Existente",
            item_type=CatalogItemType.INSTRUMENT,
        )
        content = _xlsx_bytes(
            ["sku", "name", "item_type"],
            [
                ["SKU-1", "Dup", "instrument"],
                ["SKU-2", "Nuevo", "equipment"],
                ["SKU-2", "Otro dup archivo", "equipment"],
            ],
        )
        result = import_catalog_items(self.org, SimpleUploadedFile("c.xlsx", content))
        self.assertEqual(result["created"], 1)
        self.assertEqual(result["skipped"], 2)
        self.assertEqual(InstrumentCatalogItem.objects.filter(organization=self.org).count(), 2)

    def test_import_inventory_requires_catalog_sku(self):
        content = _xlsx_bytes(
            ["code", "catalog_sku", "status"],
            [["4142434445464748494A4B4C", "MISSING", "en_stock"]],
        )
        result = import_inventory_tags(self.org, SimpleUploadedFile("i.xlsx", content))
        self.assertEqual(result["created"], 0)
        self.assertTrue(any(e["field"] == "catalog_sku" for e in result["errors"]))
        self.assertFalse(RFIDTag.objects.filter(organization=self.org).exists())

    def test_import_inventory_accepts_ascii_epc(self):
        hex_code = "4142434445464748494A4B4C"
        ascii_code = hex_to_ascii_epc(hex_code)
        content = _xlsx_bytes(
            ["code", "status"],
            [[ascii_code, "en_stock"]],
        )
        result = import_inventory_tags(self.org, SimpleUploadedFile("i.xlsx", content))
        self.assertEqual(result["created"], 1)
        tag = RFIDTag.objects.get(organization=self.org)
        self.assertEqual(tag.code, hex_code)


class BulkImportAPITests(TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        call_command("seed_modules")
        self.org = baker.make(Organization, is_active=True)
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.org,
            role=OrganizationRole.ADMIN,
        )
        for code in ("inventory_realtime", "instrumental_control"):
            module = Module.objects.get(code=code)
            OrganizationModule.objects.create(
                organization=self.org,
                module=module,
                is_active=True,
            )

    def test_download_templates(self):
        for name in (
            "inventory-import-template",
            "instrument-catalog-import-template",
            "inventory-locations-import-template",
        ):
            response = self.auth_client.get(reverse(name))
            self.assertResponse200(response)
            self.assertIn("spreadsheetml", response["Content-Type"])

    def test_post_catalog_import(self):
        content = _xlsx_bytes(
            ["sku", "name", "item_type", "category"],
            [["SKU-X", "Pinza", "instrument", "Cirugía"]],
        )
        response = self.auth_client.post(
            reverse("instrument-catalog-import"),
            {"file": SimpleUploadedFile("c.xlsx", content)},
            format="multipart",
        )
        self.assertResponse200(response)
        self.assertEqual(response.data["created"], 1)
        self.assertTrue(
            InstrumentCatalogItem.objects.filter(organization=self.org, sku="SKU-X").exists()
        )

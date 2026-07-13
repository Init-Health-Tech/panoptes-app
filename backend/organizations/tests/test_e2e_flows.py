"""End-to-end API flows covering critical Panoptes user journeys."""

from django.core.management import call_command
from django.urls import reverse

from common.utils.tests import TestCaseUtils
from inventory.models import RFIDTag, RFIDTagStatus
from logistics.models import Product, RequisitionStatus
from medical.models import SupplyKitStatus
from model_bakery import baker
from organizations.models import (
    Module,
    Organization,
    OrganizationAPIKey,
    OrganizationMembership,
    OrganizationModule,
    OrganizationRole,
)
from rest_framework.test import APIClient, APITestCase


class PanoptesE2EMixin:
    def setUp_org_with_modules(self, slug, module_codes, role=OrganizationRole.ADMIN):
        call_command("seed_modules")
        self.organization = baker.make(Organization, slug=slug, is_active=True)
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.organization,
            role=role,
        )
        for code in module_codes:
            OrganizationModule.objects.create(
                organization=self.organization,
                module=Module.objects.get(code=code),
                is_active=True,
            )


class RfidWebhookToInventoryE2ETest(PanoptesE2EMixin, TestCaseUtils, APITestCase):
    def test_webhook_creates_tag_listed_in_inventory_api(self):
        self.setUp_org_with_modules("e2e-rfid", ["inventory_realtime"], OrganizationRole.WAREHOUSE)
        _, raw_key = OrganizationAPIKey.generate_key(self.organization)

        webhook_client = APIClient()
        webhook_client.credentials(HTTP_X_ORGANIZATION_API_KEY=raw_key)
        webhook_response = webhook_client.post(
            reverse("rfid-reads"),
            {
                "code": "EPC-E2E-9001",
                "location": "Almacén Central",
                "reader_source": "gate-demo",
                "event_type": "scan",
                "item_type": "Sutura",
                "status": RFIDTagStatus.EN_STOCK,
            },
            format="json",
        )
        self.assertResponse201(webhook_response)

        list_response = self.auth_client.get(reverse("rfid-tag-list"))
        self.assertResponse200(list_response)
        codes = [row["code"] for row in list_response.data["results"]]
        self.assertIn("EPC-E2E-9001", codes)


class SupplyKitTransitDashboardE2ETest(PanoptesE2EMixin, TestCaseUtils, APITestCase):
    def test_kit_tags_and_transit_updates_medical_dashboard(self):
        self.setUp_org_with_modules("e2e-medical", ["medical_kits", "inventory_realtime"])

        stats_before = self.auth_client.get(reverse("medical-dashboard-stats"))
        self.assertResponse200(stats_before)
        transit_before = stats_before.data["kits_in_transit"]

        tag = baker.make(RFIDTag, organization=self.organization, code="EPC-KIT-E2E")

        create_response = self.auth_client.post(
            reverse("supply-kit-list"),
            {
                "name": "Maleta E2E",
                "code": "MK-E2E",
                "status": SupplyKitStatus.ARMANDO,
                "destination_hospital": "Hospital Test",
            },
            format="json",
        )
        self.assertResponse201(create_response)
        kit_id = create_response.data["id"]

        add_response = self.auth_client.post(
            reverse("supply-kit-add-tags", kwargs={"pk": kit_id}),
            {"tag_ids": [tag.id]},
            format="json",
        )
        self.assertResponse200(add_response)
        self.assertEqual(add_response.data["tag_count"], 1)

        update_response = self.auth_client.patch(
            reverse("supply-kit-detail", kwargs={"pk": kit_id}),
            {"status": SupplyKitStatus.EN_TRANSITO},
            format="json",
        )
        self.assertResponse200(update_response)

        stats_after = self.auth_client.get(reverse("medical-dashboard-stats"))
        self.assertResponse200(stats_after)
        self.assertEqual(stats_after.data["kits_in_transit"], transit_before + 1)


class RequisitionPendingKpiE2ETest(PanoptesE2EMixin, TestCaseUtils, APITestCase):
    def test_new_requisition_increments_pending_kpi(self):
        self.setUp_org_with_modules(
            "e2e-logistics",
            ["logistics_requisitions", "logistics_catalog"],
            OrganizationRole.LOGISTICS_COORDINATOR,
        )
        product = baker.make(
            Product,
            organization=self.organization,
            sku="E2E-001",
            name="Producto E2E",
        )

        stats_before = self.auth_client.get(reverse("logistics-dashboard-stats"))
        self.assertResponse200(stats_before)
        pending_before = stats_before.data["pending_requisitions"]

        create_response = self.auth_client.post(
            reverse("requisition-list"),
            {
                "origin": "CEDIS Norte",
                "destination": "Hospital Sur",
                "status": RequisitionStatus.SOLICITADA,
                "lines": [{"product": product.id, "quantity": 5}],
            },
            format="json",
        )
        self.assertResponse201(create_response)
        self.assertEqual(create_response.data["lines"][0]["quantity"], 5)

        stats_after = self.auth_client.get(reverse("logistics-dashboard-stats"))
        self.assertResponse200(stats_after)
        self.assertEqual(stats_after.data["pending_requisitions"], pending_before + 1)

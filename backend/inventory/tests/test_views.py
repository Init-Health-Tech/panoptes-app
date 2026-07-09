from django.core.management import call_command
from django.urls import reverse

from common.utils.tests import TestCaseUtils
from model_bakery import baker
from rest_framework.test import APITestCase

from inventory.models import RFIDReadEvent, RFIDTag, RFIDTagStatus
from organizations.models import (
    Module,
    Organization,
    OrganizationAPIKey,
    OrganizationMembership,
    OrganizationModule,
    OrganizationRole,
)
from users.models import User


class InventoryTestMixin:
    def setUp_inventory_org(self):
        call_command("seed_modules")
        self.organization = baker.make(Organization, slug="inv-org", is_active=True)
        self.other_organization = baker.make(Organization, slug="other-inv", is_active=True)
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.organization,
            role=OrganizationRole.WAREHOUSE,
        )
        inventory_module = Module.objects.get(code="inventory_realtime")
        OrganizationModule.objects.create(
            organization=self.organization,
            module=inventory_module,
            is_active=True,
        )
        OrganizationModule.objects.create(
            organization=self.other_organization,
            module=inventory_module,
            is_active=True,
        )


class RFIDTagViewSetTest(InventoryTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_inventory_org()

    def test_list_tags_filtered_by_status(self):
        baker.make(
            RFIDTag,
            organization=self.organization,
            code="TAG-001",
            status=RFIDTagStatus.EN_STOCK,
            last_location="Almacén A",
            item_type="Instrumental",
        )
        baker.make(
            RFIDTag,
            organization=self.organization,
            code="TAG-002",
            status=RFIDTagStatus.EN_TRANSITO,
            last_location="Ruta 5",
            item_type="Consumible",
        )

        response = self.auth_client.get(
            reverse("rfid-tag-list"),
            {"status": RFIDTagStatus.EN_STOCK},
        )

        self.assertResponse200(response)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["code"], "TAG-001")

    def test_list_tags_filtered_by_location_and_item_type(self):
        baker.make(
            RFIDTag,
            organization=self.organization,
            code="TAG-A",
            last_location="Hospital Central",
            item_type="Sutura",
        )
        baker.make(
            RFIDTag,
            organization=self.organization,
            code="TAG-B",
            last_location="Clínica Norte",
            item_type="Sutura",
        )

        response = self.auth_client.get(
            reverse("rfid-tag-list"),
            {"location": "Hospital", "item_type": "Sutura"},
        )

        self.assertResponse200(response)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["code"], "TAG-A")

    def test_tag_from_other_organization_not_visible(self):
        baker.make(RFIDTag, organization=self.other_organization, code="OTHER-TAG")

        response = self.auth_client.get(reverse("rfid-tag-list"))

        self.assertResponse200(response)
        self.assertEqual(response.data["count"], 0)

    def test_returns_403_without_inventory_module(self):
        OrganizationModule.objects.filter(organization=self.organization).update(is_active=False)

        response = self.auth_client.get(reverse("rfid-tag-list"))

        self.assertResponse403(response)

    def test_pagination(self):
        baker.make(
            RFIDTag,
            organization=self.organization,
            _quantity=15,
        )

        response = self.auth_client.get(reverse("rfid-tag-list"), {"limit": 10})

        self.assertResponse200(response)
        self.assertEqual(response.data["count"], 15)
        self.assertEqual(len(response.data["results"]), 10)


class RFIDReadWebhookTest(InventoryTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_inventory_org()
        self.api_key, self.raw_key = OrganizationAPIKey.generate_key(self.organization)
        self.client.credentials(HTTP_X_ORGANIZATION_API_KEY=self.raw_key)

    def test_webhook_creates_tag_and_event(self):
        response = self.client.post(
            reverse("rfid-reads"),
            {
                "code": "EPC-1001",
                "location": "Puerta 3",
                "reader_source": "gateway-01",
                "event_type": "scan",
                "item_type": "Kit quirúrgico",
                "status": RFIDTagStatus.EN_STOCK,
            },
            format="json",
        )

        self.assertResponse201(response)
        self.assertTrue(response.data["tag_created"])
        tag = RFIDTag.objects.get(code="EPC-1001", organization=self.organization)
        self.assertEqual(tag.last_location, "Puerta 3")
        self.assertEqual(RFIDReadEvent.objects.filter(tag=tag).count(), 1)
        self.api_key.refresh_from_db()
        self.assertIsNotNone(self.api_key.last_used_at)

    def test_webhook_updates_existing_tag(self):
        tag = baker.make(
            RFIDTag,
            organization=self.organization,
            code="EPC-2002",
            status=RFIDTagStatus.EN_STOCK,
            last_location="Almacén",
        )

        response = self.client.post(
            reverse("rfid-reads"),
            {
                "code": "EPC-2002",
                "location": "Ambulancia 4",
                "reader_source": "gateway-02",
                "event_type": "departure",
                "status": RFIDTagStatus.EN_TRANSITO,
            },
            format="json",
        )

        self.assertResponse201(response)
        self.assertFalse(response.data["tag_created"])
        tag.refresh_from_db()
        self.assertEqual(tag.status, RFIDTagStatus.EN_TRANSITO)
        self.assertEqual(tag.last_location, "Ambulancia 4")

    def test_webhook_rejects_invalid_api_key(self):
        from rest_framework.test import APIClient

        client = APIClient()
        response = client.post(
            reverse("rfid-reads"),
            {"code": "X", "event_type": "scan"},
            format="json",
            HTTP_X_ORGANIZATION_API_KEY="invalid-key-value",
        )

        self.assertIn(response.status_code, [401, 403])


class InventoryDashboardStatsTest(InventoryTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_inventory_org()
        baker.make(
            RFIDTag,
            organization=self.organization,
            status=RFIDTagStatus.EN_STOCK,
            _quantity=3,
        )
        baker.make(
            RFIDTag,
            organization=self.organization,
            status=RFIDTagStatus.EN_TRANSITO,
            _quantity=2,
        )
        baker.make(
            RFIDTag,
            organization=self.organization,
            status=RFIDTagStatus.DADO_DE_BAJA,
            _quantity=1,
        )

    def test_dashboard_stats(self):
        response = self.auth_client.get(reverse("inventory-dashboard-stats"))

        self.assertResponse200(response)
        self.assertEqual(response.data["active_tags"], 5)
        self.assertEqual(response.data["tags_in_stock"], 3)
        self.assertEqual(response.data["tags_in_transit"], 2)

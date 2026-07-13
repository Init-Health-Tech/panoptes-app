from django.core.management import call_command
from django.urls import reverse

from common.utils.tests import TestCaseUtils
from inventory.models import RFIDTag, RFIDTagStatus
from medical.models import SupplyKit, SupplyKitStatus, SupplyKitTag, Technician
from model_bakery import baker
from organizations.models import (
    Module,
    Organization,
    OrganizationMembership,
    OrganizationModule,
    OrganizationRole,
)
from rest_framework.test import APITestCase


class CustodyFlowTest(TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        call_command("seed_modules")
        self.organization = baker.make(Organization, slug="custody-org", is_active=True)
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.organization,
            role=OrganizationRole.ADMIN,
        )
        for code in ("medical_kits", "medical_staff", "inventory_realtime"):
            OrganizationModule.objects.create(
                organization=self.organization,
                module=Module.objects.get(code=code),
                is_active=True,
            )
        self.tag = baker.make(
            RFIDTag,
            organization=self.organization,
            code="EPC-CUSTODY-1",
            status=RFIDTagStatus.EN_STOCK,
        )
        self.technician = baker.make(Technician, organization=self.organization, is_active=True)
        self.kit_a = baker.make(
            SupplyKit,
            organization=self.organization,
            code="MK-A",
            status=SupplyKitStatus.ARMANDO,
        )
        self.kit_b = baker.make(
            SupplyKit,
            organization=self.organization,
            code="MK-B",
            status=SupplyKitStatus.ARMANDO,
        )

    def test_tag_cannot_join_two_open_kits(self):
        ok = self.auth_client.post(
            reverse("supply-kit-add-tags", kwargs={"pk": self.kit_a.id}),
            {"tag_ids": [self.tag.id]},
            format="json",
        )
        self.assertResponse200(ok)

        blocked = self.auth_client.post(
            reverse("supply-kit-add-tags", kwargs={"pk": self.kit_b.id}),
            {"tag_ids": [self.tag.id]},
            format="json",
        )
        self.assertResponse400(blocked)
        self.assertIn("custodia", blocked.data["detail"].lower())

    def test_dispatch_syncs_rfid_status_and_releases_on_warehouse(self):
        SupplyKitTag.objects.create(
            organization=self.organization,
            supply_kit=self.kit_a,
            tag=self.tag,
        )
        dispatch = self.auth_client.post(
            reverse("supply-kit-assign-dispatch", kwargs={"pk": self.kit_a.id}),
            {
                "transporter_name": "Transportes INIT",
                "assigned_technician": self.technician.id,
            },
            format="json",
        )
        self.assertResponse200(dispatch)
        self.tag.refresh_from_db()
        self.assertEqual(self.tag.status, RFIDTagStatus.EN_TRANSITO)

        self.auth_client.post(reverse("supply-kit-confirm-hospital-arrival", kwargs={"pk": self.kit_a.id}))
        self.tag.refresh_from_db()
        self.assertEqual(self.tag.status, RFIDTagStatus.EN_USO)

        self.auth_client.post(
            reverse("supply-kit-update-return-checklist", kwargs={"pk": self.kit_a.id}),
            {"items": [{"code": self.tag.code, "item_type": "", "checked": True}]},
            format="json",
        )
        warehouse = self.auth_client.post(
            reverse("supply-kit-confirm-warehouse-return", kwargs={"pk": self.kit_a.id}),
        )
        self.assertResponse200(warehouse)
        self.tag.refresh_from_db()
        self.assertEqual(self.tag.status, RFIDTagStatus.EN_STOCK)

        list_response = self.auth_client.get(reverse("rfid-tag-list"))
        self.assertResponse200(list_response)
        row = next(r for r in list_response.data["results"] if r["code"] == self.tag.code)
        self.assertTrue(row["is_available"])

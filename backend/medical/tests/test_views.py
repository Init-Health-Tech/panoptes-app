from django.core.management import call_command
from django.urls import reverse

from common.utils.tests import TestCaseUtils
from inventory.models import RFIDTag
from medical.models import Doctor, Procedure, SupplyKit, SupplyKitStatus, SupplyKitTag, Technician
from model_bakery import baker
from organizations.models import (
    Module,
    Organization,
    OrganizationMembership,
    OrganizationModule,
    OrganizationRole,
)
from rest_framework.test import APITestCase


class MedicalTestMixin:
    def setUp_medical_org(self, modules=None):
        call_command("seed_modules")
        self.organization = baker.make(Organization, slug="med-org", is_active=True)
        self.other_organization = baker.make(Organization, slug="med-other", is_active=True)
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.organization,
            role=OrganizationRole.ADMIN,
        )

        if modules is None:
            modules = ["medical_supplies", "medical_kits", "medical_staff"]

        for code in modules:
            module = Module.objects.get(code=code)
            OrganizationModule.objects.create(
                organization=self.organization,
                module=module,
                is_active=True,
            )
            OrganizationModule.objects.create(
                organization=self.other_organization,
                module=module,
                is_active=True,
            )


class DoctorViewSetTest(MedicalTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_medical_org()

    def test_create_and_list_doctors(self):
        response = self.auth_client.post(
            reverse("doctor-list"),
            {"name": "Dr. López", "specialty": "Cardiología", "hospital": "Central"},
            format="json",
        )
        self.assertResponse201(response)
        list_response = self.auth_client.get(reverse("doctor-list"))
        self.assertResponse200(list_response)
        self.assertEqual(list_response.data["count"], 1)

    def test_doctor_from_other_org_not_visible(self):
        baker.make(Doctor, organization=self.other_organization, name="Other Doc")
        response = self.auth_client.get(reverse("doctor-list"))
        self.assertResponse200(response)
        self.assertEqual(response.data["count"], 0)

    def test_returns_403_without_medical_staff_module(self):
        OrganizationModule.objects.filter(
            organization=self.organization,
            module__code="medical_staff",
        ).update(is_active=False)
        response = self.auth_client.get(reverse("doctor-list"))
        self.assertResponse403(response)


class SupplyKitViewSetTest(MedicalTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_medical_org()

    def test_create_supply_kit_and_add_tags(self):
        tag = baker.make(RFIDTag, organization=self.organization, code="TAG-MED-1")
        other_tag = baker.make(RFIDTag, organization=self.other_organization, code="TAG-OTHER")

        create_response = self.auth_client.post(
            reverse("supply-kit-list"),
            {
                "name": "Maleta QX-01",
                "code": "MK-001",
                "status": SupplyKitStatus.ARMANDO,
                "destination_hospital": "Hospital Norte",
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

        invalid_response = self.auth_client.post(
            reverse("supply-kit-add-tags", kwargs={"pk": kit_id}),
            {"tag_ids": [other_tag.id]},
            format="json",
        )
        self.assertResponse400(invalid_response)

    def test_filter_supply_kits_by_status(self):
        baker.make(
            SupplyKit,
            organization=self.organization,
            code="A1",
            status=SupplyKitStatus.EN_TRANSITO,
        )
        baker.make(
            SupplyKit,
            organization=self.organization,
            code="A2",
            status=SupplyKitStatus.ARMANDO,
        )

        response = self.auth_client.get(
            reverse("supply-kit-list"),
            {"status": SupplyKitStatus.EN_TRANSITO},
        )
        self.assertResponse200(response)
        self.assertEqual(response.data["count"], 1)


class ProcedureViewSetTest(MedicalTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_medical_org(modules=["medical_supplies", "medical_kits", "medical_staff"])

    def test_create_procedure(self):
        response = self.auth_client.post(
            reverse("procedure-list"),
            {
                "procedure_type": "Angioplastia",
                "destination_hospital": "Santa Fe",
                "scheduled_date": "2026-08-15",
                "status": "scheduled",
            },
            format="json",
        )
        self.assertResponse201(response)

    def test_kits_only_org_cannot_access_doctors(self):
        OrganizationModule.objects.filter(
            organization=self.organization,
            module__code="medical_staff",
        ).update(is_active=False)

        response = self.auth_client.get(reverse("doctor-list"))
        self.assertResponse403(response)

        kit_response = self.auth_client.get(reverse("supply-kit-list"))
        self.assertResponse200(kit_response)


class ProcedureAssignmentTest(MedicalTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_medical_org()
        self.procedure = baker.make(Procedure, organization=self.organization)
        self.technician = baker.make(Technician, organization=self.organization)
        self.doctor = baker.make(Doctor, organization=self.organization)

    def test_create_assignment(self):
        response = self.auth_client.post(
            reverse("procedure-assignment-list"),
            {
                "procedure": self.procedure.id,
                "technician": self.technician.id,
                "doctor": self.doctor.id,
                "role": "lead_technician",
            },
            format="json",
        )
        self.assertResponse201(response)


class MedicalDashboardStatsTest(MedicalTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_medical_org(modules=["medical_kits"])

    def test_dashboard_stats(self):
        baker.make(
            SupplyKit,
            organization=self.organization,
            status=SupplyKitStatus.EN_TRANSITO,
            _quantity=2,
        )
        response = self.auth_client.get(reverse("medical-dashboard-stats"))
        self.assertResponse200(response)
        self.assertEqual(response.data["kits_in_transit"], 2)

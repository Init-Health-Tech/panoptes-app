from decimal import Decimal

from django.core.management import call_command
from django.urls import reverse

from common.utils.tests import TestCaseUtils
from instrumental.models import (
    CatalogItemType,
    DispatchStatus,
    HandheldEventType,
    HospitalSite,
    InstrumentCatalogItem,
    InstrumentContractLine,
    InstrumentPriceContract,
    InstrumentProcedureRequest,
    InstrumentRequestLine,
    QuotationStatus,
    RequestStatus,
)
from inventory.models import RFIDTag, RFIDTagStatus
from medical.models import Doctor, Procedure, Technician
from model_bakery import baker
from organizations.models import (
    Module,
    Organization,
    OrganizationMembership,
    OrganizationModule,
    OrganizationRole,
)
from rest_framework.test import APITestCase


class InstrumentalTestMixin:
    def setUp_instrumental_org(self):
        call_command("seed_modules")
        self.organization = baker.make(Organization, slug="inst-org", is_active=True)
        self.other_organization = baker.make(Organization, slug="inst-other", is_active=True)
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.organization,
            role=OrganizationRole.ADMIN,
        )
        module = Module.objects.get(code="instrumental_control")
        OrganizationModule.objects.create(organization=self.organization, module=module, is_active=True)
        OrganizationModule.objects.create(organization=self.other_organization, module=module, is_active=True)

        self.central = baker.make(
            HospitalSite,
            organization=self.organization,
            code="ALM-CENTRAL",
            name="Almacén central",
            is_central=True,
        )
        self.hospital = baker.make(
            HospitalSite,
            organization=self.organization,
            code="H-01",
            name="Hospital Norte",
        )
        self.procedure = baker.make(Procedure, organization=self.organization)
        self.doctor = baker.make(Doctor, organization=self.organization)
        self.technician = baker.make(Technician, organization=self.organization)
        self.tag = baker.make(
            RFIDTag,
            organization=self.organization,
            code="INST-TEST-01",
            status=RFIDTagStatus.EN_STOCK,
        )
        self.catalog_rfid = baker.make(
            InstrumentCatalogItem,
            organization=self.organization,
            sku="INST-TEST-01",
            name="Instrumento test",
            item_type=CatalogItemType.INSTRUMENT,
            requires_sterilization=True,
            rfid_tag=self.tag,
        )
        self.catalog_sku = baker.make(
            InstrumentCatalogItem,
            organization=self.organization,
            sku="SKU-TEST-MONITOR",
            name="Monitor SKU",
            item_type=CatalogItemType.EQUIPMENT,
        )
        from instrumental.models import TransportVehicle

        self.vehicle = baker.make(
            TransportVehicle,
            organization=self.organization,
            code="VAN-1",
            name="Van 1",
        )


class InstrumentalWorkflowTest(InstrumentalTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_instrumental_org()

    def _create_submitted_request(self):
        request = baker.make(
            InstrumentProcedureRequest,
            organization=self.organization,
            procedure=self.procedure,
            doctor=self.doctor,
            destination_hospital=self.hospital,
            status=RequestStatus.SUBMITTED,
        )
        InstrumentRequestLine.objects.create(
            organization=self.organization,
            request=request,
            catalog_item=self.catalog_rfid,
            quantity=1,
        )
        InstrumentRequestLine.objects.create(
            organization=self.organization,
            request=request,
            catalog_item=self.catalog_sku,
            quantity=1,
        )
        return request

    def test_full_workflow_rfid_and_sku_handheld(self):
        request = self._create_submitted_request()

        quote_response = self.auth_client.post(
            reverse("instrument-procedure-request-create-quotation", kwargs={"pk": request.pk}),
        )
        self.assertResponse201(quote_response)
        self.assertEqual(quote_response.data["status"], QuotationStatus.PENDING_DOCTOR)

        accept_response = self.auth_client.post(
            reverse("instrument-procedure-request-accept-quotation", kwargs={"pk": request.pk}),
        )
        self.assertResponse200(accept_response)

        plan_response = self.auth_client.post(
            reverse("instrument-procedure-request-plan-fulfillment", kwargs={"pk": request.pk}),
            {
                "vehicle": self.vehicle.id,
                "lead_technician": self.technician.id,
            },
            format="json",
        )
        self.assertResponse201(plan_response)
        dispatches = plan_response.data["dispatches"]
        self.assertEqual(len(dispatches), 2)

        rfid_dispatch = next(d for d in dispatches if d.get("rfid_code"))
        sku_dispatch = next(d for d in dispatches if d.get("sku") == "SKU-TEST-MONITOR")

        scan_rfid = self.auth_client.post(
            reverse("instrumental-handheld-scans"),
            {
                "identifier": "INST-TEST-01",
                "event_type": HandheldEventType.LOAD_DEPARTURE,
                "hospital": self.central.id,
                "handheld_id": "HH-01",
            },
            format="json",
        )
        self.assertResponse201(scan_rfid)
        self.assertEqual(scan_rfid.data["dispatch_status"], DispatchStatus.LOADED)

        scan_sku = self.auth_client.post(
            reverse("instrumental-handheld-scans"),
            {
                "identifier": "SKU-TEST-MONITOR",
                "event_type": HandheldEventType.LOAD_DEPARTURE,
                "hospital": self.central.id,
            },
            format="json",
        )
        self.assertResponse201(scan_sku)

        arrival = self.auth_client.post(
            reverse("instrumental-handheld-scans"),
            {
                "identifier": rfid_dispatch["tracking_identifier"],
                "event_type": HandheldEventType.HOSPITAL_ARRIVAL,
                "hospital": self.hospital.id,
            },
            format="json",
        )
        self.assertResponse201(arrival)
        self.assertEqual(arrival.data["dispatch_status"], DispatchStatus.AT_HOSPITAL)

        stats = self.auth_client.get(reverse("instrumental-dashboard-stats"))
        self.assertResponse200(stats)
        self.assertGreaterEqual(stats.data["materials_in_field"], 1)

    def test_forbidden_without_module(self):
        OrganizationModule.objects.filter(
            organization=self.organization,
            module__code="instrumental_control",
        ).update(is_active=False)
        response = self.auth_client.get(reverse("hospital-site-list"))
        self.assertResponse403(response)

    def test_plan_fulfillment_creates_dispatch_per_quantity(self):
        request = self._create_submitted_request()
        request.lines.update(quantity=2)
        self.auth_client.post(
            reverse("instrument-procedure-request-create-quotation", kwargs={"pk": request.pk}),
        )
        self.auth_client.post(
            reverse("instrument-procedure-request-accept-quotation", kwargs={"pk": request.pk}),
        )
        vehicle = baker.make(
            "instrumental.TransportVehicle",
            organization=self.organization,
            code="VAN-QTY",
            name="Van qty",
        )
        response = self.auth_client.post(
            reverse("instrument-procedure-request-plan-fulfillment", kwargs={"pk": request.pk}),
            {"vehicle": vehicle.id, "lead_technician": self.technician.id},
            format="json",
        )
        self.assertResponse201(response)
        # 2 lines × quantity 2 = 4 dispatches
        self.assertEqual(len(response.data["dispatches"]), 4)

    def test_unload_material_from_load(self):
        request = self._create_submitted_request()
        self.auth_client.post(
            reverse("instrument-procedure-request-create-quotation", kwargs={"pk": request.pk}),
        )
        self.auth_client.post(
            reverse("instrument-procedure-request-accept-quotation", kwargs={"pk": request.pk}),
        )
        plan_response = self.auth_client.post(
            reverse("instrument-procedure-request-plan-fulfillment", kwargs={"pk": request.pk}),
            {"vehicle": self.vehicle.id, "lead_technician": self.technician.id},
            format="json",
        )
        self.assertResponse201(plan_response)
        rfid_dispatch = next(d for d in plan_response.data["dispatches"] if d.get("rfid_code"))
        scan = self.auth_client.post(
            reverse("instrumental-handheld-scans"),
            {"identifier": rfid_dispatch["rfid_code"], "event_type": HandheldEventType.LOAD_DEPARTURE},
            format="json",
        )
        self.assertResponse201(scan)
        unload = self.auth_client.post(
            reverse("material-dispatch-unload", kwargs={"pk": rfid_dispatch["id"]}),
        )
        self.assertResponse200(unload)
        self.assertEqual(unload.data["status"], DispatchStatus.ASSIGNED)

    def test_search_procedure_requests(self):
        req = self._create_submitted_request()
        by_doctor = self.auth_client.get(
            reverse("instrument-procedure-request-list"),
            {"search": self.doctor.name},
        )
        self.assertResponse200(by_doctor)
        ids = [row["id"] for row in by_doctor.data["results"]]
        self.assertIn(req.id, ids)

        by_type = self.auth_client.get(
            reverse("instrument-procedure-request-list"),
            {"search": req.procedure.procedure_type},
        )
        self.assertResponse200(by_type)
        self.assertIn(req.id, [row["id"] for row in by_type.data["results"]])

        miss = self.auth_client.get(
            reverse("instrument-procedure-request-list"),
            {"search": "zzz-no-match-zzz"},
        )
        self.assertResponse200(miss)
        self.assertEqual(miss.data["count"], 0)

    def test_quotation_uses_doctor_hospital_contract_prices(self):
        contract = InstrumentPriceContract.objects.create(
            organization=self.organization,
            name="Contrato test doctor+hospital",
            doctor=self.doctor,
            hospital=self.hospital,
            is_active=True,
        )
        InstrumentContractLine.objects.create(
            organization=self.organization,
            contract=contract,
            catalog_item=self.catalog_rfid,
            unit_price=Decimal("99.00"),
        )
        InstrumentContractLine.objects.create(
            organization=self.organization,
            contract=contract,
            catalog_item=self.catalog_sku,
            unit_price=Decimal("333.00"),
        )

        request = self._create_submitted_request()
        quote_response = self.auth_client.post(
            reverse("instrument-procedure-request-create-quotation", kwargs={"pk": request.pk}),
        )
        self.assertResponse201(quote_response)
        self.assertEqual(quote_response.data["applied_contract"], contract.id)
        prices = {line["catalog_sku"]: Decimal(line["unit_price"]) for line in quote_response.data["lines"]}
        self.assertEqual(prices["INST-TEST-01"], Decimal("99.00"))
        self.assertEqual(prices["SKU-TEST-MONITOR"], Decimal("333.00"))
        sources = {line["catalog_sku"]: line["price_source"] for line in quote_response.data["lines"]}
        self.assertEqual(sources["INST-TEST-01"], "doctor_hospital")

    def test_create_price_contract(self):
        response = self.auth_client.post(
            reverse("instrument-price-contract-list"),
            {
                "name": "Contrato hospital Norte",
                "doctor": None,
                "hospital": self.hospital.id,
                "is_active": True,
                "lines": [
                    {"catalog_item": self.catalog_rfid.id, "unit_price": "111.00"},
                ],
            },
            format="json",
        )
        self.assertResponse201(response)
        self.assertEqual(response.data["scope_label"], "hospital")
        self.assertEqual(len(response.data["lines"]), 1)


class InstrumentalIsolationTest(InstrumentalTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_instrumental_org()
        baker.make(HospitalSite, organization=self.other_organization, code="OTHER-H")

    def test_hospitals_isolated_by_org(self):
        response = self.auth_client.get(reverse("hospital-site-list"))
        self.assertResponse200(response)
        codes = [row["code"] for row in response.data["results"]]
        self.assertIn("ALM-CENTRAL", codes)
        self.assertNotIn("OTHER-H", codes)

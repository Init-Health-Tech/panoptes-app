from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from instrumental.models import (
    HospitalSite,
    InstrumentCatalogItem,
    InstrumentPriceContract,
    InstrumentProcedureRequest,
    InstrumentQuotation,
    RequestStatus,
)
from inventory.models import RFIDTag
from organizations.management.commands.seed_demo import avant_ascii, avant_epc, DEMO_RFID_SEQ
from organizations.models import Organization


class SeedDemoInstrumentalTest(TestCase):
    def test_seed_demo_creates_instrumental_data_for_clinica(self):
        out = StringIO()
        call_command("seed_demo", stdout=out)

        org = Organization.objects.get(slug="init-clinica")
        self.assertTrue(HospitalSite.objects.filter(organization=org, code="ALM-CENTRAL", is_central=True).exists())
        self.assertTrue(HospitalSite.objects.filter(organization=org, code="H-ANG").exists())
        self.assertGreater(InstrumentCatalogItem.objects.filter(organization=org).count(), 3)
        self.assertGreaterEqual(InstrumentPriceContract.objects.filter(organization=org).count(), 3)
        self.assertTrue(
            InstrumentProcedureRequest.objects.filter(organization=org).exists(),
        )
        self.assertTrue(
            InstrumentProcedureRequest.objects.filter(
                organization=org,
                status__in=[RequestStatus.SUBMITTED, RequestStatus.QUOTATION],
            ).exists(),
        )
        self.assertTrue(InstrumentQuotation.objects.filter(organization=org).exists())
        scope_epc = avant_epc(DEMO_RFID_SEQ["SCOPE-01"])
        self.assertTrue(RFIDTag.objects.filter(organization=org, code=scope_epc).exists())
        self.assertEqual(avant_ascii(DEMO_RFID_SEQ["SCOPE-01"]), "AVANT0000011")

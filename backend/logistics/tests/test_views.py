from decimal import Decimal

from django.core.management import call_command
from django.urls import reverse

from common.utils.tests import TestCaseUtils
from logistics.models import (
    Client,
    Product,
    Provider,
    Requisition,
    RequisitionStatus,
    SalesOrder,
)
from model_bakery import baker
from organizations.models import (
    Module,
    Organization,
    OrganizationMembership,
    OrganizationModule,
    OrganizationRole,
)
from rest_framework.test import APITestCase


class LogisticsTestMixin:
    def setUp_logistics_org(self, modules=None):
        call_command("seed_modules")
        self.organization = baker.make(Organization, slug="log-org", is_active=True)
        self.other_organization = baker.make(Organization, slug="log-other", is_active=True)
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.organization,
            role=OrganizationRole.LOGISTICS_COORDINATOR,
        )

        if modules is None:
            modules = [
                "logistics_catalog",
                "logistics_requisitions",
                "logistics_sales_purchases",
            ]

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


class ProductViewSetTest(LogisticsTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_logistics_org()

    def test_create_product(self):
        response = self.auth_client.post(
            reverse("product-list"),
            {"sku": "SKU-001", "name": "Guantes", "category": "EPP", "unit": "caja"},
            format="json",
        )
        self.assertResponse201(response)

    def test_product_not_visible_from_other_org(self):
        baker.make(Product, organization=self.other_organization, sku="X", name="Other")
        response = self.auth_client.get(reverse("product-list"))
        self.assertResponse200(response)
        self.assertEqual(response.data["count"], 0)

    def test_403_without_catalog_module(self):
        OrganizationModule.objects.filter(
            organization=self.organization,
            module__code="logistics_catalog",
        ).update(is_active=False)
        response = self.auth_client.get(reverse("product-list"))
        self.assertResponse403(response)


class RequisitionViewSetTest(LogisticsTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_logistics_org()
        self.product = baker.make(Product, organization=self.organization, sku="P1", name="Producto")

    def test_create_requisition_with_lines(self):
        response = self.auth_client.post(
            reverse("requisition-list"),
            {
                "origin": "Almacén Central",
                "destination": "Sucursal Norte",
                "status": RequisitionStatus.SOLICITADA,
                "lines": [{"product": self.product.id, "quantity": 5}],
            },
            format="json",
        )
        self.assertResponse201(response)
        self.assertEqual(len(response.data["lines"]), 1)

    def test_filter_by_status(self):
        baker.make(
            Requisition,
            organization=self.organization,
            origin="A",
            destination="B",
            status=RequisitionStatus.SOLICITADA,
        )
        baker.make(
            Requisition,
            organization=self.organization,
            origin="C",
            destination="D",
            status=RequisitionStatus.ENTREGADA,
        )
        response = self.auth_client.get(
            reverse("requisition-list"),
            {"status": RequisitionStatus.SOLICITADA},
        )
        self.assertResponse200(response)
        self.assertEqual(response.data["count"], 1)

    def test_rejects_product_from_other_org(self):
        other_product = baker.make(Product, organization=self.other_organization, sku="X", name="X")
        response = self.auth_client.post(
            reverse("requisition-list"),
            {
                "origin": "A",
                "destination": "B",
                "lines": [{"product": other_product.id, "quantity": 1}],
            },
            format="json",
        )
        self.assertResponse400(response)


class SalesOrderViewSetTest(LogisticsTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_logistics_org()
        self.client_org = baker.make(Client, organization=self.organization, business_name="Cliente SA")
        self.product = baker.make(Product, organization=self.organization, sku="S1", name="Item")

    def test_create_sales_order_with_total(self):
        response = self.auth_client.post(
            reverse("sales-order-list"),
            {
                "client": self.client_org.id,
                "status": "borrador",
                "lines": [{"product": self.product.id, "quantity": 2, "unit_price": "150.50"}],
            },
            format="json",
        )
        self.assertResponse201(response)
        self.assertEqual(Decimal(response.data["total"]), Decimal("301.00"))

    def test_403_without_sales_purchases_module(self):
        OrganizationModule.objects.filter(
            organization=self.organization,
            module__code="logistics_sales_purchases",
        ).update(is_active=False)
        response = self.auth_client.get(reverse("sales-order-list"))
        self.assertResponse403(response)


class LogisticsDashboardStatsTest(LogisticsTestMixin, TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.setUp_logistics_org(modules=["logistics_requisitions"])

    def test_pending_requisitions_count(self):
        baker.make(
            Requisition,
            organization=self.organization,
            origin="A",
            destination="B",
            status=RequisitionStatus.SOLICITADA,
            _quantity=3,
        )
        response = self.auth_client.get(reverse("logistics-dashboard-stats"))
        self.assertResponse200(response)
        self.assertEqual(response.data["pending_requisitions"], 3)

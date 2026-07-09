from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.core.management import call_command

from inventory.models import RFIDTag, RFIDTagStatus
from logistics.models import (
    Client,
    OrderStatus,
    Product,
    Provider,
    PurchaseOrder,
    PurchaseOrderLine,
    Requisition,
    RequisitionLine,
    RequisitionStatus,
    SalesOrder,
    SalesOrderLine,
)
from medical.models import Doctor, Procedure, SupplyKit, SupplyKitStatus, Technician
from organizations.constants import MODULE_SEED_DATA
from organizations.models import (
    Module,
    Organization,
    OrganizationMembership,
    OrganizationModule,
    OrganizationRole,
)


class Command(BaseCommand):
    help = "Seed demo organization, modules, user membership and sample data for local dev."

    def handle(self, *args, **options):
        call_command("seed_modules")
        User = get_user_model()

        org, _ = Organization.objects.get_or_create(
            slug="init-demo",
            defaults={
                "name": "INIT Health Demo",
                "industry_type": "mixed",
                "is_active": True,
            },
        )

        for entry in MODULE_SEED_DATA:
            module = Module.objects.get(code=entry["code"])
            OrganizationModule.objects.update_or_create(
                organization=org,
                module=module,
                defaults={"is_active": True},
            )

        user, created = User.objects.get_or_create(
            email="demo@init.health",
            defaults={"is_active": True, "is_staff": True, "is_superuser": True},
        )
        if created:
            user.set_password("demo1234")
            user.save()
            self.stdout.write(self.style.SUCCESS("Created demo user demo@init.health / demo1234"))
        else:
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.set_password("demo1234")
            user.save()
            self.stdout.write("Demo user ready: demo@init.health / demo1234")

        OrganizationMembership.objects.update_or_create(
            user=user,
            organization=org,
            defaults={"role": OrganizationRole.ADMIN},
        )

        RFIDTag.objects.get_or_create(
            organization=org,
            code="EPC-DEMO-001",
            defaults={
                "item_type": "Sutura",
                "status": RFIDTagStatus.EN_STOCK,
                "last_location": "Almacén Central",
            },
        )
        RFIDTag.objects.get_or_create(
            organization=org,
            code="EPC-DEMO-002",
            defaults={
                "item_type": "Kit quirúrgico",
                "status": RFIDTagStatus.EN_TRANSITO,
                "last_location": "Ambulancia 2",
            },
        )

        procedure, _ = Procedure.objects.get_or_create(
            organization=org,
            procedure_type="Angioplastia",
            destination_hospital="Hospital ABC Santa Fe",
            scheduled_date="2026-08-20",
            defaults={"status": "scheduled"},
        )

        SupplyKit.objects.get_or_create(
            organization=org,
            code="MK-DEMO-01",
            defaults={
                "name": "Maleta Cardio QX",
                "procedure": procedure,
                "status": SupplyKitStatus.EN_TRANSITO,
                "destination_hospital": "Hospital ABC Santa Fe",
            },
        )

        Doctor.objects.get_or_create(
            organization=org,
            name="Dr. García",
            defaults={"specialty": "Cardiología", "hospital": "ABC Santa Fe"},
        )
        Technician.objects.get_or_create(
            organization=org,
            name="Téc. Martínez",
            defaults={"is_active": True},
        )

        product_sutura, _ = Product.objects.get_or_create(
            organization=org,
            sku="SUT-001",
            defaults={"name": "Sutura absorbible 3-0", "category": "Quirúrgico", "unit": "pza"},
        )
        product_kit, _ = Product.objects.get_or_create(
            organization=org,
            sku="KIT-CARD-01",
            defaults={"name": "Kit angioplastia básico", "category": "Cardiología", "unit": "kit"},
        )

        client, _ = Client.objects.get_or_create(
            organization=org,
            business_name="Hospital ABC Santa Fe",
            defaults={"contact": "compras@hospitalabc.mx"},
        )
        provider, _ = Provider.objects.get_or_create(
            organization=org,
            business_name="MedSupply MX",
            defaults={"contact": "ventas@medsupply.mx"},
        )

        req_pending, _ = Requisition.objects.get_or_create(
            organization=org,
            origin="Almacén Central",
            destination="Hospital ABC Santa Fe",
            status=RequisitionStatus.SOLICITADA,
            defaults={},
        )
        if not req_pending.lines.exists():
            RequisitionLine.objects.create(
                organization=org,
                requisition=req_pending,
                product=product_sutura,
                quantity=10,
            )

        req_transit, _ = Requisition.objects.get_or_create(
            organization=org,
            origin="CEDIS Norte",
            destination="Clínica Sur",
            status=RequisitionStatus.EN_TRANSITO,
            defaults={},
        )
        if not req_transit.lines.exists():
            RequisitionLine.objects.create(
                organization=org,
                requisition=req_transit,
                product=product_kit,
                quantity=2,
            )

        sales_order, _ = SalesOrder.objects.get_or_create(
            organization=org,
            client=client,
            status=OrderStatus.CONFIRMADA,
            defaults={"total": Decimal("4500.00")},
        )
        if not sales_order.lines.exists():
            SalesOrderLine.objects.create(
                organization=org,
                sales_order=sales_order,
                product=product_kit,
                quantity=1,
                unit_price=Decimal("4500.00"),
            )

        purchase_order, _ = PurchaseOrder.objects.get_or_create(
            organization=org,
            provider=provider,
            status=OrderStatus.BORRADOR,
            defaults={"total": Decimal("1200.00")},
        )
        if not purchase_order.lines.exists():
            PurchaseOrderLine.objects.create(
                organization=org,
                purchase_order=purchase_order,
                product=product_sutura,
                quantity=20,
                unit_price=Decimal("60.00"),
            )

        self.stdout.write(self.style.SUCCESS(f"Demo data ready for organization '{org.name}'"))

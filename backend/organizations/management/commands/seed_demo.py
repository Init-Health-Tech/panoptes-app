from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand

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
from medical.models import Doctor, Procedure, SupplyKit, SupplyKitStatus, SupplyKitTag, Technician
from organizations.constants import INSTRUMENTAL_PRODUCT_MODULES, MODULE_SEED_DATA
from organizations.models import (
    Module,
    Organization,
    OrganizationAPIKey,
    OrganizationMembership,
    OrganizationModule,
    OrganizationRole,
)

# Control de instrumental product + inventario (clinical org offering).
CLINICAL_MODULES = [
    "inventory_realtime",
    *INSTRUMENTAL_PRODUCT_MODULES,
]

LOGISTICS_MODULES = [
    "inventory_realtime",
    "logistics_requisitions",
    "logistics_catalog",
    "logistics_sales_purchases",
]

ALL_MODULE_CODES = [entry["code"] for entry in MODULE_SEED_DATA]


class Command(BaseCommand):
    help = (
        "Seed demo organizations (mixed, clínica, logística), users, sample data "
        "and optional RFID API keys for local development."
    )

    def handle(self, *args, **options):
        call_command("seed_modules")
        call_command("seed_packages")
        User = get_user_model()
        created_keys: list[tuple[str, str]] = []

        mixed_org = self._ensure_organization(
            slug="init-demo",
            name="INIT Health Demo",
            industry_type="mixed",
            module_codes=ALL_MODULE_CODES,
        )
        clinical_org = self._ensure_organization(
            slug="init-clinica",
            name="INIT Clínica Demo",
            industry_type="clinical",
            module_codes=CLINICAL_MODULES,
        )
        logistics_org = self._ensure_organization(
            slug="init-logistica",
            name="INIT Logística Demo",
            industry_type="logistics",
            module_codes=LOGISTICS_MODULES,
        )

        demo_users = [
            ("demo@init.health", mixed_org, OrganizationRole.ADMIN, True),
            ("clinica@init.health", clinical_org, OrganizationRole.ADMIN, False),
            ("logistica@init.health", logistics_org, OrganizationRole.LOGISTICS_COORDINATOR, False),
        ]
        for email, org, role, is_superuser in demo_users:
            self._ensure_user(User, email, org, role, is_superuser=is_superuser)

        self._seed_inventory(mixed_org, prefix="DEMO")
        self._seed_inventory(clinical_org, prefix="CLN")
        self._seed_inventory(logistics_org, prefix="LOG")

        self._seed_clinical_data(mixed_org)
        self._seed_clinical_data(clinical_org)

        self._seed_instrumental_data(mixed_org, prefix="DEMO")
        self._seed_instrumental_data(clinical_org, prefix="CLN")

        self._seed_logistics_data(mixed_org)
        self._seed_logistics_data(logistics_org)

        for org in (mixed_org, clinical_org, logistics_org):
            raw_key = self._ensure_api_key(org)
            if raw_key:
                created_keys.append((org.slug, raw_key))

        self.stdout.write(self.style.SUCCESS("Demo environments ready:"))
        self.stdout.write("  demo@init.health / demo1234       → INIT Health Demo (todos los módulos)")
        self.stdout.write("  clinica@init.health / demo1234    → INIT Clínica Demo (inventario + médico + instrumental)")
        self.stdout.write("  logistica@init.health / demo1234 → INIT Logística Demo (inventario + logística)")
        if created_keys:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("RFID webhook API keys (guárdalas, solo se muestran una vez):"))
            for slug, raw_key in created_keys:
                self.stdout.write(f"  {slug}: X-Organization-Api-Key: {raw_key}")
        else:
            self.stdout.write("")
            self.stdout.write("RFID API keys ya existen — rota desde Django admin si necesitas una nueva.")

    def _ensure_organization(self, slug, name, industry_type, module_codes, account_type="internal"):
        org, _ = Organization.objects.get_or_create(
            slug=slug,
            defaults={
                "name": name,
                "industry_type": industry_type,
                "is_active": True,
                "account_type": account_type,
            },
        )
        org.name = name
        org.industry_type = industry_type
        org.is_active = True
        org.account_type = account_type
        org.save(update_fields=["name", "industry_type", "is_active", "account_type"])

        active_codes = set(module_codes)
        for entry in MODULE_SEED_DATA:
            module = Module.objects.get(code=entry["code"])
            OrganizationModule.objects.update_or_create(
                organization=org,
                module=module,
                defaults={"is_active": entry["code"] in active_codes},
            )
        return org

    def _ensure_user(self, User, email, organization, role, is_superuser=False):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={"is_active": True, "is_staff": True, "is_superuser": is_superuser},
        )
        user.is_staff = True
        user.is_superuser = is_superuser or user.is_superuser
        user.is_active = True
        user.set_password("demo1234")
        user.save()

        OrganizationMembership.objects.update_or_create(
            user=user,
            organization=organization,
            defaults={"role": role},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created user {email} / demo1234"))
        return user

    def _ensure_api_key(self, organization):
        if OrganizationAPIKey.objects.filter(organization=organization, is_active=True).exists():
            return None
        _, raw_key = OrganizationAPIKey.generate_key(organization)
        return raw_key

    def _seed_inventory(self, org, prefix):
        # Ejemplos básicos: equipo médico, consumibles e instrumental
        examples = [
            ("EQ-01", "Monitor multiparámetros", RFIDTagStatus.EN_STOCK, "Almacén Central"),
            ("EQ-02", "Bomba de infusión", RFIDTagStatus.EN_STOCK, "Almacén Central"),
            ("CON-01", "Sutura Vicryl 3-0", RFIDTagStatus.EN_STOCK, "Almacén Central"),
            ("CON-02", "Guantes estériles 7.5", RFIDTagStatus.EN_STOCK, "Almacén Central"),
            ("CON-03", "Catéter guía 6F", RFIDTagStatus.EN_TRANSITO, "Ambulancia 2"),
            ("INS-01", "Pinza Kelly curva", RFIDTagStatus.EN_STOCK, "Almacén Central"),
            ("INS-02", "Charola angioplastia", RFIDTagStatus.EN_STOCK, "Almacén Central"),
            ("INS-03", "Endoscopio flexible", RFIDTagStatus.EN_STOCK, "Almacén Central"),
        ]
        for code_suffix, item_type, status, location in examples:
            RFIDTag.objects.get_or_create(
                organization=org,
                code=f"EPC-{prefix}-{code_suffix}",
                defaults={
                    "item_type": item_type,
                    "status": status,
                    "last_location": location,
                },
            )

        # Tags legacy del seed anterior (compatibilidad)
        RFIDTag.objects.get_or_create(
            organization=org,
            code=f"EPC-{prefix}-001",
            defaults={
                "item_type": "Sutura",
                "status": RFIDTagStatus.EN_STOCK,
                "last_location": "Almacén Central",
            },
        )
        RFIDTag.objects.get_or_create(
            organization=org,
            code=f"EPC-{prefix}-002",
            defaults={
                "item_type": "Kit quirúrgico",
                "status": RFIDTagStatus.EN_TRANSITO,
                "last_location": "Ambulancia 2",
            },
        )

    def _seed_clinical_data(self, org):
        doctor, _ = Doctor.objects.get_or_create(
            organization=org,
            name="Dr. García",
            defaults={"specialty": "Cardiología", "hospital": "ABC Santa Fe"},
        )
        technician, _ = Technician.objects.get_or_create(
            organization=org,
            name="Téc. Martínez",
            defaults={"is_active": True},
        )

        procedure, _ = Procedure.objects.get_or_create(
            organization=org,
            procedure_type="Angioplastia",
            destination_hospital="Hospital ABC Santa Fe",
            scheduled_date="2026-08-20",
            defaults={"status": "scheduled", "doctor": doctor},
        )
        if procedure.doctor_id is None:
            procedure.doctor = doctor
            procedure.save(update_fields=["doctor"])

        kit, _ = SupplyKit.objects.get_or_create(
            organization=org,
            code=f"MK-{org.slug[:3].upper()}-01",
            defaults={
                "name": "Envío mixto Cardio QX",
                "procedure": procedure,
                "status": SupplyKitStatus.EN_TRANSITO,
                "destination_hospital": "Hospital ABC Santa Fe",
                "transporter_name": "Transportes INIT",
                "assigned_technician": technician,
            },
        )
        if kit.assigned_technician_id is None:
            kit.assigned_technician = technician
            kit.transporter_name = kit.transporter_name or "Transportes INIT"
            kit.save(update_fields=["assigned_technician", "transporter_name", "modified"])

        # Mezcla de equipo, consumible e instrumental en el envío demo
        prefix = "CLN" if "clin" in org.slug else "DEMO"
        for code_suffix, item_type in (
            (f"EPC-{prefix}-EQ-01", "Monitor multiparámetros"),
            (f"EPC-{prefix}-CON-03", "Catéter guía 6F"),
            (f"EPC-{prefix}-INS-02", "Charola angioplastia"),
        ):
            tag, _ = RFIDTag.objects.get_or_create(
                organization=org,
                code=code_suffix,
                defaults={
                    "item_type": item_type,
                    "status": RFIDTagStatus.EN_TRANSITO,
                    "last_location": "Hospital ABC Santa Fe",
                },
            )
            SupplyKitTag.objects.get_or_create(
                supply_kit=kit,
                tag=tag,
                defaults={"organization": org},
            )

        # Segundo envío en armado con más ejemplos disponibles
        kit_ready, _ = SupplyKit.objects.get_or_create(
            organization=org,
            code=f"MK-{org.slug[:3].upper()}-02",
            defaults={
                "name": "Equipo + consumibles + instrumental",
                "status": SupplyKitStatus.LISTA,
                "destination_hospital": "Hospital ABC Santa Fe",
            },
        )
        for code_suffix, item_type in (
            (f"EPC-{prefix}-EQ-02", "Bomba de infusión"),
            (f"EPC-{prefix}-CON-01", "Sutura Vicryl 3-0"),
            (f"EPC-{prefix}-INS-01", "Pinza Kelly curva"),
        ):
            tag, _ = RFIDTag.objects.get_or_create(
                organization=org,
                code=code_suffix,
                defaults={
                    "item_type": item_type,
                    "status": RFIDTagStatus.EN_STOCK,
                    "last_location": "Almacén Central",
                },
            )
            SupplyKitTag.objects.get_or_create(
                supply_kit=kit_ready,
                tag=tag,
                defaults={"organization": org},
            )

    def _seed_instrumental_data(self, org, prefix):
        from datetime import date
        from decimal import Decimal as D

        from instrumental.models import (
            CatalogItemType,
            HospitalSite,
            InstrumentCatalogItem,
            InstrumentContractLine,
            InstrumentPriceContract,
            InstrumentProcedureRequest,
            InstrumentQuotation,
            InstrumentRequestLine,
            QuotationLine,
            QuotationStatus,
            RequestStatus,
            TransportVehicle,
        )
        from instrumental.services import resolve_catalog_unit_price

        central = HospitalSite.objects.filter(organization=org, is_central=True).first()
        if central is None:
            central, _ = HospitalSite.objects.get_or_create(
                organization=org,
                code="ALM-CENTRAL",
                defaults={"name": "Almacén central INIT Health", "is_central": True, "city": "CDMX"},
            )
        else:
            # Rename legacy demo site (e.g. old CRCAO label) to a generic warehouse name.
            if central.code in {"CRCAO", "ALM-CENTRAL"} or "CRCAO" in (central.name or ""):
                central.code = "ALM-CENTRAL"
                central.name = "Almacén central INIT Health"
                central.save(update_fields=["code", "name"])
        hospital_abc, _ = HospitalSite.objects.get_or_create(
            organization=org,
            code="H-ABC",
            defaults={"name": "Hospital ABC Santa Fe", "is_central": False, "city": "CDMX"},
        )
        hospital_angeles, _ = HospitalSite.objects.get_or_create(
            organization=org,
            code="H-ANG",
            defaults={"name": "Hospital Ángeles Pedregal", "is_central": False, "city": "CDMX"},
        )

        tag_scope, _ = RFIDTag.objects.get_or_create(
            organization=org,
            code=f"INST-{prefix}-SCOPE-01",
            defaults={
                "item_type": "Endoscopio",
                "status": RFIDTagStatus.EN_STOCK,
                "last_location": central.name,
            },
        )
        tag_tray, _ = RFIDTag.objects.get_or_create(
            organization=org,
            code=f"INST-{prefix}-TRAY-01",
            defaults={
                "item_type": "Charola angioplastia",
                "status": RFIDTagStatus.EN_STOCK,
                "last_location": central.name,
            },
        )
        tag_pump, _ = RFIDTag.objects.get_or_create(
            organization=org,
            code=f"INST-{prefix}-PUMP-01",
            defaults={
                "item_type": "Bomba de infusión",
                "status": RFIDTagStatus.EN_STOCK,
                "last_location": central.name,
            },
        )
        tag_van, _ = RFIDTag.objects.get_or_create(
            organization=org,
            code=f"VEH-{prefix}-VAN-01",
            defaults={
                "item_type": "Camioneta",
                "status": RFIDTagStatus.EN_STOCK,
                "last_location": central.name,
            },
        )

        scope_item, _ = InstrumentCatalogItem.objects.get_or_create(
            organization=org,
            sku=f"INST-{prefix}-SCOPE-01",
            defaults={
                "name": "Endoscopio flexible",
                "item_type": CatalogItemType.INSTRUMENT,
                "requires_sterilization": True,
                "rfid_tag": tag_scope,
                "default_unit_price": D("180.00"),
            },
        )
        if scope_item.default_unit_price is None:
            scope_item.default_unit_price = D("180.00")
            scope_item.save(update_fields=["default_unit_price", "modified"])

        tray_item, _ = InstrumentCatalogItem.objects.get_or_create(
            organization=org,
            sku=f"INST-{prefix}-TRAY-01",
            defaults={
                "name": "Charola angioplastia",
                "item_type": CatalogItemType.TRAY,
                "requires_sterilization": True,
                "rfid_tag": tag_tray,
                "default_unit_price": D("280.00"),
            },
        )
        if tray_item.default_unit_price is None:
            tray_item.default_unit_price = D("280.00")
            tray_item.save(update_fields=["default_unit_price", "modified"])

        monitor_item, _ = InstrumentCatalogItem.objects.get_or_create(
            organization=org,
            sku=f"SKU-{prefix}-MONITOR-01",
            defaults={
                "name": "Monitor hemodinámico (solo SKU demo)",
                "item_type": CatalogItemType.EQUIPMENT,
                "requires_sterilization": False,
                "default_unit_price": D("520.00"),
            },
        )
        pump_item, _ = InstrumentCatalogItem.objects.get_or_create(
            organization=org,
            sku=f"INST-{prefix}-PUMP-01",
            defaults={
                "name": "Bomba de infusión",
                "item_type": CatalogItemType.EQUIPMENT,
                "requires_sterilization": False,
                "rfid_tag": tag_pump,
                "default_unit_price": D("450.00"),
            },
        )
        kelly_item, _ = InstrumentCatalogItem.objects.get_or_create(
            organization=org,
            sku=f"INST-{prefix}-KELLY-01",
            defaults={
                "name": "Pinza Kelly curva",
                "item_type": CatalogItemType.INSTRUMENT,
                "requires_sterilization": True,
                "default_unit_price": D("95.00"),
            },
        )

        TransportVehicle.objects.get_or_create(
            organization=org,
            code=f"VAN-{prefix}",
            defaults={
                "name": "Camioneta 01",
                "plate": "INIT-01",
                "transporter_name": "Transportes INIT",
                "rfid_tag": tag_van,
            },
        )

        doctor_garcia, _ = Doctor.objects.get_or_create(
            organization=org,
            name="Dr. García",
            defaults={"specialty": "Cardiología", "hospital": "ABC Santa Fe"},
        )
        doctor_ruiz, _ = Doctor.objects.get_or_create(
            organization=org,
            name="Dra. Ruiz",
            defaults={"specialty": "Cirugía general", "hospital": "Ángeles Pedregal"},
        )

        # Contratos con precios distintos por doctor / hospital / ambos
        contract_garcia_abc, _ = InstrumentPriceContract.objects.get_or_create(
            organization=org,
            name=f"Contrato Dr. García @ ABC ({prefix})",
            doctor=doctor_garcia,
            hospital=hospital_abc,
            defaults={
                "is_active": True,
                "valid_from": date(2026, 1, 1),
                "notes": "Tarifa preferente doctor + hospital",
            },
        )
        for item, price in (
            (scope_item, D("120.00")),
            (tray_item, D("200.00")),
            (monitor_item, D("400.00")),
            (pump_item, D("350.00")),
        ):
            InstrumentContractLine.objects.get_or_create(
                organization=org,
                contract=contract_garcia_abc,
                catalog_item=item,
                defaults={"unit_price": price},
            )

        contract_ruiz, _ = InstrumentPriceContract.objects.get_or_create(
            organization=org,
            name=f"Contrato Dra. Ruiz (todos hospitales) ({prefix})",
            doctor=doctor_ruiz,
            hospital=None,
            defaults={
                "is_active": True,
                "valid_from": date(2026, 1, 1),
                "notes": "Tarifa por doctor, cualquier sede",
            },
        )
        for item, price in (
            (scope_item, D("160.00")),
            (tray_item, D("240.00")),
            (kelly_item, D("80.00")),
            (pump_item, D("420.00")),
        ):
            InstrumentContractLine.objects.get_or_create(
                organization=org,
                contract=contract_ruiz,
                catalog_item=item,
                defaults={"unit_price": price},
            )

        contract_angeles, _ = InstrumentPriceContract.objects.get_or_create(
            organization=org,
            name=f"Contrato Hospital Ángeles ({prefix})",
            doctor=None,
            hospital=hospital_angeles,
            defaults={
                "is_active": True,
                "valid_from": date(2026, 1, 1),
                "notes": "Tarifa institucional por hospital",
            },
        )
        for item, price in (
            (scope_item, D("140.00")),
            (tray_item, D("220.00")),
            (monitor_item, D("480.00")),
            (kelly_item, D("70.00")),
        ):
            InstrumentContractLine.objects.get_or_create(
                organization=org,
                contract=contract_angeles,
                catalog_item=item,
                defaults={"unit_price": price},
            )

        procedure = Procedure.objects.filter(organization=org).first()
        procedure_ruiz, _ = Procedure.objects.get_or_create(
            organization=org,
            procedure_type="Colecistectomía",
            destination_hospital="Hospital Ángeles Pedregal",
            scheduled_date="2026-09-05",
            defaults={"status": "scheduled", "doctor": doctor_ruiz},
        )
        if not procedure:
            return

        # Solicitud 1: García @ ABC (contrato doctor+hospital)
        inst_request, created = InstrumentProcedureRequest.objects.get_or_create(
            organization=org,
            procedure=procedure,
            doctor=doctor_garcia,
            destination_hospital=hospital_abc,
            defaults={
                "status": RequestStatus.SUBMITTED,
                "notes": "Solicitud demo instrumental para angioplastia",
                "estimated_out_hours": 48,
            },
        )
        if created or not inst_request.lines.exists():
            InstrumentRequestLine.objects.get_or_create(
                organization=org,
                request=inst_request,
                catalog_item=scope_item,
                defaults={"quantity": 1},
            )
            InstrumentRequestLine.objects.get_or_create(
                organization=org,
                request=inst_request,
                catalog_item=tray_item,
                defaults={"quantity": 1},
            )
            InstrumentRequestLine.objects.get_or_create(
                organization=org,
                request=inst_request,
                catalog_item=monitor_item,
                defaults={"quantity": 1},
            )

        # Solicitud 2: Ruiz @ Ángeles (puede resolver doctor-only o hospital)
        req_ruiz, created_ruiz = InstrumentProcedureRequest.objects.get_or_create(
            organization=org,
            procedure=procedure_ruiz,
            doctor=doctor_ruiz,
            destination_hospital=hospital_angeles,
            defaults={
                "status": RequestStatus.SUBMITTED,
                "notes": "Demo precios por doctor vs hospital",
                "estimated_out_hours": 36,
            },
        )
        if created_ruiz or not req_ruiz.lines.exists():
            for item, qty in ((scope_item, 1), (kelly_item, 2), (pump_item, 1)):
                InstrumentRequestLine.objects.get_or_create(
                    organization=org,
                    request=req_ruiz,
                    catalog_item=item,
                    defaults={"quantity": qty},
                )

        # Cotización demo ya generada para García (precios de contrato)
        if not InstrumentQuotation.objects.filter(request=inst_request).exists():
            quotation = InstrumentQuotation.objects.create(
                organization=org,
                request=inst_request,
                status=QuotationStatus.PENDING_DOCTOR,
                applied_contract=contract_garcia_abc,
                notes="Cotización demo con contrato doctor+hospital",
            )
            subtotal = D("0.00")
            for line in inst_request.lines.select_related("catalog_item"):
                unit_price, source, contract = resolve_catalog_unit_price(
                    org,
                    line.catalog_item,
                    doctor=inst_request.doctor,
                    hospital=inst_request.destination_hospital,
                )
                QuotationLine.objects.create(
                    organization=org,
                    quotation=quotation,
                    catalog_item=line.catalog_item,
                    quantity=line.quantity,
                    unit_price=unit_price,
                    requires_sterilization=line.catalog_item.requires_sterilization,
                    price_source=source,
                    applied_contract=contract,
                )
                subtotal += unit_price * line.quantity
            quotation.subtotal = subtotal
            quotation.save(update_fields=["subtotal", "modified"])
            inst_request.status = RequestStatus.QUOTATION
            inst_request.save(update_fields=["status", "modified"])

    def _seed_logistics_data(self, org):
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

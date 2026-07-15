from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from datetime import date

from inventory.models import RFIDTag, RFIDTagStatus
from inventory.rfid_code import ascii_to_hex_epc
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
from organizations.services_platform import enable_modules_for_organization

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

# Almacén/distribución: inventario RFID + requisiciones (entradas/salidas) + catálogo
# (productos y proveedores). Sin ventas/compras.
WAREHOUSE_MODULES = [
    "inventory_realtime",
    "logistics_requisitions",
    "logistics_catalog",
]

ALL_MODULE_CODES = [entry["code"] for entry in MODULE_SEED_DATA]

# Seriales ASCII demo (exactamente 12 chars → EPC canónico de 24 hex).
# Ejemplo: AVANT0000001 → 4156414E5430303030303031
DEMO_RFID_SEQ = {
    "EQ-01": 1,
    "EQ-02": 2,
    "CON-01": 3,
    "CON-02": 4,
    "CON-03": 5,
    "INS-01": 6,
    "INS-02": 7,
    "INS-03": 8,
    "LEGACY-001": 9,
    "LEGACY-002": 10,
    "SCOPE-01": 11,
    "TRAY-01": 12,
    "PUMP-01": 13,
    "VAN-01": 14,
}


def avant_ascii(seq: int) -> str:
    return f"AVANT{seq:07d}"


def avant_epc(seq: int) -> str:
    return ascii_to_hex_epc(avant_ascii(seq))


def telecom_ascii(seq: int) -> str:
    # 6 (TCOMBA) + 6 dígitos = 12 chars ASCII → EPC canónico de 24 hex.
    return f"TCOMBA{seq:06d}"


def telecom_epc(seq: int) -> str:
    return ascii_to_hex_epc(telecom_ascii(seq))


class Command(BaseCommand):
    help = (
        "Seed demo organizations (mixed, clínica, logística), users, sample data "
        "and optional RFID API keys for local development.\n"
        "Use --org <slug> to seed the sample data INTO an existing organization "
        "(e.g. a demo created with provision_demo)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--org",
            dest="org_slug",
            default=None,
            help=(
                "Slug de una organización existente a la que sembrarle los datos demo "
                "(en vez de crear las orgs demo por defecto)."
            ),
        )
        parser.add_argument(
            "--profile",
            default="clinical",
            choices=["clinical", "mixed", "logistics", "warehouse"],
            help=(
                "Qué conjunto de datos sembrar cuando usas --org "
                "(default: clinical). 'warehouse' = inventario + requisiciones "
                "entrada/salida + catálogo (sin ventas/compras)."
            ),
        )

    def handle(self, *args, **options):
        call_command("seed_modules")
        call_command("seed_packages")

        if options.get("org_slug"):
            self._seed_into_existing_org(options["org_slug"], options["profile"])
            return

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

    def _seed_into_existing_org(self, slug, profile):
        """Seed the sample dataset into an already-existing org (keeps its account_type)."""
        try:
            org = Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            raise CommandError(
                f"No existe una organización con slug '{slug}'. "
                "Revísalo en el admin o usa `provision_demo` para crearla primero."
            )

        if profile == "logistics":
            module_codes = LOGISTICS_MODULES
        elif profile == "warehouse":
            module_codes = WAREHOUSE_MODULES
        elif profile == "mixed":
            module_codes = ALL_MODULE_CODES
        else:
            module_codes = CLINICAL_MODULES

        # Activa los módulos del perfil SIN desactivar los que ya tenga (unión).
        active_codes = set(
            OrganizationModule.objects.filter(organization=org, is_active=True).values_list(
                "module__code", flat=True
            )
        )
        active_codes.update(module_codes)
        enable_modules_for_organization(org, list(active_codes))

        prefix = (slug[:3] or "ORG").upper()
        if profile == "warehouse":
            # Telecom: inventario RFID de equipos + proveedores + requisiciones
            # entrada/salida (NO siembra el inventario médico genérico).
            self._seed_warehouse_data(org)
        else:
            self._seed_inventory(org, prefix=prefix)
            if profile in ("clinical", "mixed"):
                self._seed_clinical_data(org)
                self._seed_instrumental_data(org, prefix=prefix)
            if profile in ("logistics", "mixed"):
                self._seed_logistics_data(org)

        self.stdout.write(
            self.style.SUCCESS(
                f"Datos demo ({profile}) sembrados en '{org.name}' (slug: {org.slug})."
            )
        )

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

    def _ensure_avant_tag(
        self,
        org,
        seq,
        *,
        item_type,
        status,
        last_location,
        inventory_location=None,
        legacy_codes=(),
        lot=None,
        expires_on=None,
        set_lot_fields=False,
    ):
        code = avant_epc(seq)
        tag = RFIDTag.objects.filter(organization=org, code=code).first()
        if tag is None:
            for legacy in legacy_codes:
                tag = RFIDTag.objects.filter(organization=org, code=legacy).first()
                if tag:
                    tag.code = code
                    break

        fields = {
            "item_type": item_type,
            "status": status,
            "last_location": last_location,
        }
        if inventory_location is not None:
            fields["inventory_location"] = inventory_location
        if set_lot_fields:
            fields["lot"] = lot or ""
            fields["expires_on"] = expires_on

        if tag:
            for key, value in fields.items():
                setattr(tag, key, value)
            tag.save()
            return tag

        create_fields = {**fields}
        if not set_lot_fields:
            create_fields.setdefault("lot", "")
            create_fields.setdefault("expires_on", None)
        return RFIDTag.objects.create(organization=org, code=code, **create_fields)

    def _ensure_tag(
        self,
        org,
        code,
        *,
        item_type,
        status,
        last_location,
        inventory_location=None,
    ):
        """Upsert an RFID tag by its (already-encoded) EPC code."""
        fields = {
            "item_type": item_type,
            "status": status,
            "last_location": last_location,
        }
        if inventory_location is not None:
            fields["inventory_location"] = inventory_location

        tag = RFIDTag.objects.filter(organization=org, code=code).first()
        if tag:
            for key, value in fields.items():
                setattr(tag, key, value)
            tag.save()
            return tag
        return RFIDTag.objects.create(
            organization=org, code=code, lot="", expires_on=None, **fields
        )

    def _ensure_api_key(self, organization):
        if OrganizationAPIKey.objects.filter(organization=organization, is_active=True).exists():
            return None
        _, raw_key = OrganizationAPIKey.generate_key(organization)
        return raw_key

    def _seed_inventory(self, org, prefix):
        # Equipo, consumibles e instrumental con serial ASCII AVANT000000N
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
            seq = DEMO_RFID_SEQ[code_suffix]
            lot = ""
            expires_on = None
            if code_suffix.startswith("CON-"):
                lot = f"LOT-{seq:04d}"
                expires_on = date(2027, 6, 30) if code_suffix != "CON-03" else date(2026, 12, 15)
            self._ensure_avant_tag(
                org,
                seq,
                item_type=item_type,
                status=status,
                last_location=location,
                legacy_codes=(f"EPC-{prefix}-{code_suffix}",),
                lot=lot,
                expires_on=expires_on,
                set_lot_fields=True,
            )

        self._ensure_avant_tag(
            org,
            DEMO_RFID_SEQ["LEGACY-001"],
            item_type="Sutura",
            status=RFIDTagStatus.EN_STOCK,
            last_location="Almacén Central",
            legacy_codes=(f"EPC-{prefix}-001",),
        )
        self._ensure_avant_tag(
            org,
            DEMO_RFID_SEQ["LEGACY-002"],
            item_type="Kit quirúrgico",
            status=RFIDTagStatus.EN_TRANSITO,
            last_location="Ambulancia 2",
            legacy_codes=(f"EPC-{prefix}-002",),
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
        for seq_key, item_type in (
            ("EQ-01", "Monitor multiparámetros"),
            ("CON-03", "Catéter guía 6F"),
            ("INS-02", "Charola angioplastia"),
        ):
            tag = self._ensure_avant_tag(
                org,
                DEMO_RFID_SEQ[seq_key],
                item_type=item_type,
                status=RFIDTagStatus.EN_TRANSITO,
                last_location="Hospital ABC Santa Fe",
                legacy_codes=(f"EPC-{prefix}-{seq_key}",),
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
        for seq_key, item_type in (
            ("EQ-02", "Bomba de infusión"),
            ("CON-01", "Sutura Vicryl 3-0"),
            ("INS-01", "Pinza Kelly curva"),
        ):
            tag = self._ensure_avant_tag(
                org,
                DEMO_RFID_SEQ[seq_key],
                item_type=item_type,
                status=RFIDTagStatus.EN_STOCK,
                last_location="Almacén Central",
                legacy_codes=(f"EPC-{prefix}-{seq_key}",),
            )
            SupplyKitTag.objects.get_or_create(
                supply_kit=kit_ready,
                tag=tag,
                defaults={"organization": org},
            )

    def _seed_instrumental_data(self, org, prefix):
        from datetime import date
        from decimal import Decimal as D

        from inventory.models import InventoryLocation, InventoryLocationType, RFIDTag, RFIDTagStatus
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

        loc_central, _ = InventoryLocation.objects.get_or_create(
            organization=org,
            code="LOC-CENTRAL",
            defaults={
                "name": central.name,
                "location_type": InventoryLocationType.WAREHOUSE,
            },
        )
        InventoryLocation.objects.get_or_create(
            organization=org,
            code="LOC-ABC",
            defaults={
                "name": hospital_abc.name,
                "location_type": InventoryLocationType.HOSPITAL,
            },
        )
        InventoryLocation.objects.get_or_create(
            organization=org,
            code="LOC-ANG",
            defaults={
                "name": hospital_angeles.name,
                "location_type": InventoryLocationType.HOSPITAL,
            },
        )
        InventoryLocation.objects.get_or_create(
            organization=org,
            code="LOC-EST",
            defaults={
                "name": "Zona esterilización",
                "location_type": InventoryLocationType.ZONE,
            },
        )

        tag_scope = self._ensure_avant_tag(
            org,
            DEMO_RFID_SEQ["SCOPE-01"],
            item_type="Endoscopio flexible",
            status=RFIDTagStatus.EN_STOCK,
            last_location=central.name,
            inventory_location=loc_central,
            legacy_codes=(f"INST-{prefix}-SCOPE-01",),
        )
        tag_tray = self._ensure_avant_tag(
            org,
            DEMO_RFID_SEQ["TRAY-01"],
            item_type="Charola angioplastia",
            status=RFIDTagStatus.EN_STOCK,
            last_location=central.name,
            inventory_location=loc_central,
            legacy_codes=(f"INST-{prefix}-TRAY-01",),
        )
        tag_pump = self._ensure_avant_tag(
            org,
            DEMO_RFID_SEQ["PUMP-01"],
            item_type="Bomba de infusión",
            status=RFIDTagStatus.EN_STOCK,
            last_location=central.name,
            inventory_location=loc_central,
            legacy_codes=(f"INST-{prefix}-PUMP-01",),
        )
        tag_van = self._ensure_avant_tag(
            org,
            DEMO_RFID_SEQ["VAN-01"],
            item_type="Camioneta",
            status=RFIDTagStatus.EN_STOCK,
            last_location=central.name,
            inventory_location=loc_central,
            legacy_codes=(f"VEH-{prefix}-VAN-01",),
        )

        scope_item, _ = InstrumentCatalogItem.objects.get_or_create(
            organization=org,
            sku=f"INST-{prefix}-SCOPE-01",
            defaults={
                "name": "Endoscopio flexible",
                "item_type": CatalogItemType.INSTRUMENT,
                "category": "Endoscopía",
                "brand": "Olympus",
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
                "category": "Cardiología",
                "brand": "INIT",
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
                "category": "Cardiología",
                "brand": "Philips",
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
                "category": "Cuidados intensivos",
                "brand": "Baxter",
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
                "category": "Cirugía general",
                "brand": "Aesculap",
                "requires_sterilization": True,
                "default_unit_price": D("95.00"),
            },
        )
        InstrumentCatalogItem.objects.get_or_create(
            organization=org,
            sku=f"SKU-{prefix}-SUTURE-01",
            defaults={
                "name": "Sutura absorbible 3-0",
                "item_type": CatalogItemType.CONSUMABLE,
                "category": "Consumibles",
                "brand": "Ethicon",
                "unit": "caja",
                "requires_sterilization": False,
                "default_unit_price": D("42.00"),
            },
        )

        for tag, catalog in (
            (tag_scope, scope_item),
            (tag_tray, tray_item),
            (tag_pump, pump_item),
        ):
            if tag.catalog_item_id != catalog.id or tag.inventory_location_id != loc_central.id:
                tag.catalog_item = catalog
                tag.inventory_location = loc_central
                tag.save()

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

    def _seed_warehouse_data(self, org):
        """Demo de almacén/distribución de TELECOM: inventario RFID de routers/módems/etc,
        proveedores de telecom y requisiciones de salida/entrada entre almacenes."""
        from inventory.models import InventoryLocation, InventoryLocationType

        # Almacenes (ubicaciones de inventario)
        loc_central, _ = InventoryLocation.objects.get_or_create(
            organization=org,
            code="ALM-CENTRAL",
            defaults={
                "name": "Almacén Central Telecomba",
                "location_type": InventoryLocationType.WAREHOUSE,
            },
        )
        loc_norte, _ = InventoryLocation.objects.get_or_create(
            organization=org,
            code="SUC-NORTE",
            defaults={
                "name": "Sucursal Norte",
                "location_type": InventoryLocationType.WAREHOUSE,
            },
        )
        loc_occ, _ = InventoryLocation.objects.get_or_create(
            organization=org,
            code="SUC-OCC",
            defaults={
                "name": "Sucursal Occidente",
                "location_type": InventoryLocationType.WAREHOUSE,
            },
        )

        # Inventario RFID: equipo de telecom con serial ASCII TCOMBA000001..
        telecom_stock = [
            (1, "Router WiFi 6 AX3000", RFIDTagStatus.EN_STOCK, loc_central),
            (2, "Módem GPON ONT dual-band", RFIDTagStatus.EN_STOCK, loc_central),
            (3, "Switch Gigabit 24 puertos", RFIDTagStatus.EN_STOCK, loc_central),
            (4, "Antena sectorial 5 GHz", RFIDTagStatus.EN_STOCK, loc_central),
            (5, "Repetidor mesh WiFi", RFIDTagStatus.EN_TRANSITO, loc_norte),
            (6, "ONT fibra óptica XPON", RFIDTagStatus.EN_STOCK, loc_central),
            (7, "Router empresarial VPN", RFIDTagStatus.EN_STOCK, loc_central),
            (8, "Decodificador IPTV 4K", RFIDTagStatus.EN_TRANSITO, loc_occ),
        ]
        for seq, item_type, status, loc in telecom_stock:
            self._ensure_tag(
                org,
                telecom_epc(seq),
                item_type=item_type,
                status=status,
                last_location=loc.name,
                inventory_location=loc,
            )

        # Catálogo de productos de telecom
        product_specs = [
            ("RTR-AX3000", "Router WiFi 6 AX3000", "Routers", "pza"),
            ("MDM-GPON-01", "Módem GPON ONT dual-band", "Módems", "pza"),
            ("SW-GIGA-24", "Switch Gigabit 24 puertos", "Switches", "pza"),
            ("ONT-XPON-01", "ONT fibra óptica XPON", "ONT", "pza"),
            ("MESH-WIFI-01", "Repetidor mesh WiFi", "Repetidores", "pza"),
            ("IPTV-4K-01", "Decodificador IPTV 4K", "Decodificadores", "pza"),
        ]
        products = {}
        for sku, name, category, unit in product_specs:
            products[sku], _ = Product.objects.get_or_create(
                organization=org,
                sku=sku,
                defaults={"name": name, "category": category, "unit": unit},
            )

        # Proveedores de telecom (de quienes adquieren la mercancía)
        for business_name, contact in [
            ("Cisco Distribución MX", "ventas@ciscodist.mx"),
            ("Huawei Technologies MX", "mayoreo@huawei.mx"),
            ("TP-Link México", "b2b@tp-link.mx"),
        ]:
            Provider.objects.get_or_create(
                organization=org,
                business_name=business_name,
                defaults={"contact": contact},
            )

        # Requisición de SALIDA (Almacén Central → Sucursal Norte)
        req_out, _ = Requisition.objects.get_or_create(
            organization=org,
            origin="Almacén Central Telecomba",
            destination="Sucursal Norte",
            status=RequisitionStatus.SOLICITADA,
            defaults={},
        )
        if not req_out.lines.exists():
            RequisitionLine.objects.create(
                organization=org, requisition=req_out, product=products["RTR-AX3000"], quantity=25
            )
            RequisitionLine.objects.create(
                organization=org, requisition=req_out, product=products["MDM-GPON-01"], quantity=40
            )

        # Requisición de ENTRADA/tránsito (CEDIS Bajío → Sucursal Occidente)
        req_in, _ = Requisition.objects.get_or_create(
            organization=org,
            origin="CEDIS Bajío",
            destination="Sucursal Occidente",
            status=RequisitionStatus.EN_TRANSITO,
            defaults={},
        )
        if not req_in.lines.exists():
            RequisitionLine.objects.create(
                organization=org, requisition=req_in, product=products["SW-GIGA-24"], quantity=10
            )
            RequisitionLine.objects.create(
                organization=org, requisition=req_in, product=products["ONT-XPON-01"], quantity=15
            )

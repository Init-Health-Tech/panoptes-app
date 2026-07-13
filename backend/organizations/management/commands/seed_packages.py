from django.core.management.base import BaseCommand

from organizations.constants import PRODUCT_PACKAGE_SEED_DATA
from organizations.models import Module, ProductPackage, ProductPackageModule


class Command(BaseCommand):
    help = "Upsert sellable ProductPackage bundles and their module links."

    def handle(self, *args, **options):
        created_packages = 0
        for entry in PRODUCT_PACKAGE_SEED_DATA:
            package, created = ProductPackage.objects.update_or_create(
                code=entry["code"],
                defaults={
                    "name": entry["name"],
                    "description": entry.get("description", ""),
                    "is_public": True,
                },
            )
            if created:
                created_packages += 1

            ProductPackageModule.objects.filter(package=package).exclude(
                module__code__in=entry["modules"],
            ).delete()

            for index, module_code in enumerate(entry["modules"]):
                try:
                    module = Module.objects.get(code=module_code)
                except Module.DoesNotExist:
                    self.stderr.write(self.style.WARNING(f"Module missing: {module_code}"))
                    continue
                ProductPackageModule.objects.update_or_create(
                    package=package,
                    module=module,
                    defaults={"sort_order": index},
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Product packages synced ({created_packages} created, "
                f"{len(PRODUCT_PACKAGE_SEED_DATA)} total)."
            )
        )

from django.core.management.base import BaseCommand

from organizations.constants import MODULE_SEED_DATA
from organizations.models import Module


class Command(BaseCommand):
    help = "Seed the canonical Panoptes module catalog."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for entry in MODULE_SEED_DATA:
            module, created = Module.objects.update_or_create(
                code=entry["code"],
                defaults={
                    "name": entry["name"],
                    "description": entry["description"],
                },
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created module: {module.code}"))
            else:
                updated_count += 1
                self.stdout.write(f"Updated module: {module.code}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {created_count} created, {updated_count} updated "
                f"({len(MODULE_SEED_DATA)} total)."
            )
        )

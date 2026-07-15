from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from organizations.models import IndustryType
from organizations.services_platform import provision_demo


class Command(BaseCommand):
    help = (
        "Create a demo organization + admin user with an expiry (default 7 days). "
        "Example: manage.py provision_demo demo@cliente.com --name 'Cliente Demo' --days 7"
    )

    def add_arguments(self, parser):
        parser.add_argument("email", help="Email/login of the demo admin user.")
        parser.add_argument(
            "--name",
            default="",
            help="Organization name (defaults to the email domain).",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=7,
            help="Demo duration in days (default: 7).",
        )
        parser.add_argument(
            "--password",
            default=None,
            help="Password for the demo user (default: random, printed once).",
        )
        parser.add_argument(
            "--packages",
            default="pkg_full",
            help="Comma-separated package codes (default: pkg_full). "
            "Options: pkg_full, pkg_instrumental, pkg_inventory, pkg_logistics.",
        )
        parser.add_argument(
            "--industry",
            default=IndustryType.MIXED,
            choices=[choice.value for choice in IndustryType],
            help="Industry type (default: mixed).",
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        if "@" not in email:
            raise CommandError(f"Email inválido: {email!r}")

        # Ensure modules/packages exist before assigning them.
        call_command("seed_modules")
        call_command("seed_packages")

        name = options["name"].strip() or email.split("@", 1)[1]
        packages = [code.strip() for code in options["packages"].split(",") if code.strip()]

        result = provision_demo(
            name=name,
            contact_email=email,
            contact_name=name,
            duration_days=options["days"],
            package_codes=packages,
            industry_type=options["industry"],
            password=options["password"],
        )

        org = result["organization"]
        password = result["password"]
        expires = result["demo_expires_at"]

        self.stdout.write(self.style.SUCCESS("Demo provisionada:"))
        self.stdout.write(f"  Organización: {org.name} (slug: {org.slug})")
        self.stdout.write(f"  Usuario:      {email}")
        if password:
            self.stdout.write(f"  Contraseña:   {password}")
        else:
            self.stdout.write(
                "  Contraseña:   (usuario ya existía; no se cambió. Usa --password para resetear.)"
            )
        self.stdout.write(f"  Expira:       {expires:%Y-%m-%d %H:%M} UTC ({options['days']} días)")
        self.stdout.write(f"  Paquetes:     {', '.join(result['packages']) or '(fallback instrumental)'}")

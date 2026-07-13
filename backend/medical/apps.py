from django.apps import AppConfig


class MedicalConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "medical"
    verbose_name = "Control de instrumental (datos clínicos)"

    module_codes = (
        "medical_supplies",
        "medical_kits",
        "medical_staff",
    )

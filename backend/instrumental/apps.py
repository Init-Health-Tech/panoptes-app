from django.apps import AppConfig


class InstrumentalConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "instrumental"
    verbose_name = "Control de instrumental"

    module_code = "instrumental_control"

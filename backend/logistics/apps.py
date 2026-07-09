from django.apps import AppConfig


class LogisticsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "logistics"
    verbose_name = "Logistics"

    module_codes = (
        "logistics_requisitions",
        "logistics_sales_purchases",
        "logistics_catalog",
    )

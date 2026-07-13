from django.urls import path

from inventory.import_views import (
    InstrumentCatalogImportTemplateView,
    InstrumentCatalogImportView,
    InventoryImportTemplateView,
    InventoryImportView,
    InventoryLocationImportTemplateView,
    InventoryLocationImportView,
)
from inventory.views import InventoryDashboardStatsView, RFIDReadWebhookView


urlpatterns = [
    path("rfid-reads/", RFIDReadWebhookView.as_view(), name="rfid-reads"),
    path(
        "inventory/dashboard-stats/",
        InventoryDashboardStatsView.as_view(),
        name="inventory-dashboard-stats",
    ),
    # Prefixed to avoid clashing with DRF router detail routes (…/<pk>/).
    path(
        "bulk-import/inventory/template/",
        InventoryImportTemplateView.as_view(),
        name="inventory-import-template",
    ),
    path("bulk-import/inventory/", InventoryImportView.as_view(), name="inventory-import"),
    path(
        "bulk-import/locations/template/",
        InventoryLocationImportTemplateView.as_view(),
        name="inventory-locations-import-template",
    ),
    path(
        "bulk-import/locations/",
        InventoryLocationImportView.as_view(),
        name="inventory-locations-import",
    ),
    path(
        "bulk-import/catalog/template/",
        InstrumentCatalogImportTemplateView.as_view(),
        name="instrument-catalog-import-template",
    ),
    path(
        "bulk-import/catalog/",
        InstrumentCatalogImportView.as_view(),
        name="instrument-catalog-import",
    ),
]

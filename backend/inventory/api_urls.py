from django.urls import path

from inventory.views import InventoryDashboardStatsView, RFIDReadWebhookView


urlpatterns = [
    path("rfid-reads/", RFIDReadWebhookView.as_view(), name="rfid-reads"),
    path(
        "inventory/dashboard-stats/",
        InventoryDashboardStatsView.as_view(),
        name="inventory-dashboard-stats",
    ),
]

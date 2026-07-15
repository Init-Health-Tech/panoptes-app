from django.urls import path

from logistics.views import LogisticsDashboardStatsView, ScanProductView


urlpatterns = [
    path(
        "logistics/dashboard-stats/",
        LogisticsDashboardStatsView.as_view(),
        name="logistics-dashboard-stats",
    ),
    path(
        "logistics/scan-product/",
        ScanProductView.as_view(),
        name="logistics-scan-product",
    ),
]

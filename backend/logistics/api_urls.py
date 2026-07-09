from django.urls import path

from logistics.views import LogisticsDashboardStatsView


urlpatterns = [
    path(
        "logistics/dashboard-stats/",
        LogisticsDashboardStatsView.as_view(),
        name="logistics-dashboard-stats",
    ),
]

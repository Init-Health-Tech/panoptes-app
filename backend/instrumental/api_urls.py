from django.urls import path

from instrumental.views import HandheldScanView, InstrumentalDashboardStatsView

urlpatterns = [
    path("instrumental/handheld-scans/", HandheldScanView.as_view(), name="instrumental-handheld-scans"),
    path(
        "instrumental/dashboard-stats/",
        InstrumentalDashboardStatsView.as_view(),
        name="instrumental-dashboard-stats",
    ),
]

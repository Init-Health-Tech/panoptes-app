from django.urls import path

from medical.views import MedicalDashboardStatsView


urlpatterns = [
    path(
        "medical/dashboard-stats/",
        MedicalDashboardStatsView.as_view(),
        name="medical-dashboard-stats",
    ),
]

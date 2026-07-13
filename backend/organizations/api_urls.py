from django.urls import path

from organizations.platform_views import (
    PlatformAssignPackageView,
    PlatformExtendDemoView,
    PlatformOrgUsageDetailView,
    PlatformOrganizationDetailView,
    PlatformOrganizationListCreateView,
    PlatformPackageListView,
    PlatformPurgeDemoView,
    PlatformUsageSummaryView,
)
from organizations.views import (
    ActiveModulesView,
    DashboardChartsView,
    DemoRequestLicenseView,
    ModuleProbeView,
)


urlpatterns = [
    path("active-modules/", ActiveModulesView.as_view(), name="active-modules"),
    path(
        "modules/<slug:module_code>/probe/",
        ModuleProbeView.as_view(),
        name="module-probe",
    ),
    path("dashboard/charts/", DashboardChartsView.as_view(), name="dashboard-charts"),
    path("demo/request-license/", DemoRequestLicenseView.as_view(), name="demo-request-license"),
    path(
        "platform/organizations/",
        PlatformOrganizationListCreateView.as_view(),
        name="platform-organizations",
    ),
    path(
        "platform/organizations/<int:pk>/",
        PlatformOrganizationDetailView.as_view(),
        name="platform-organization-detail",
    ),
    path(
        "platform/organizations/<int:pk>/purge-demo/",
        PlatformPurgeDemoView.as_view(),
        name="platform-purge-demo",
    ),
    path(
        "platform/organizations/<int:pk>/extend-demo/",
        PlatformExtendDemoView.as_view(),
        name="platform-extend-demo",
    ),
    path(
        "platform/organizations/<int:pk>/assign-package/",
        PlatformAssignPackageView.as_view(),
        name="platform-assign-package",
    ),
    path(
        "platform/organizations/<int:pk>/usage/",
        PlatformOrgUsageDetailView.as_view(),
        name="platform-org-usage",
    ),
    path("platform/packages/", PlatformPackageListView.as_view(), name="platform-packages"),
    path("platform/usage/summary/", PlatformUsageSummaryView.as_view(), name="platform-usage-summary"),
]

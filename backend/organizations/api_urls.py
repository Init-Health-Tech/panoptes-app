from django.urls import path

from organizations.views import ActiveModulesView, ModuleProbeView


urlpatterns = [
    path("active-modules/", ActiveModulesView.as_view(), name="active-modules"),
    path(
        "modules/<slug:module_code>/probe/",
        ModuleProbeView.as_view(),
        name="module-probe",
    ),
]

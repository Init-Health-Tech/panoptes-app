from django.contrib import admin
from django.urls import include, path

import django_js_reverse.views
from common.routes import routes as common_routes
from inventory.routes import routes as inventory_routes
from instrumental.routes import routes as instrumental_routes
from logistics.routes import routes as logistics_routes
from medical.routes import routes as medical_routes
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.routers import DefaultRouter
from users.routes import routes as users_routes


router = DefaultRouter()

routes = common_routes + users_routes + inventory_routes + medical_routes + logistics_routes + instrumental_routes
for route in routes:
    router.register(route["regex"], route["viewset"], basename=route["basename"])

urlpatterns = [
    path("", include("common.urls"), name="common"),
    path("admin/", admin.site.urls, name="admin"),
    path("admin/defender/", include("defender.urls")),
    path("jsreverse/", django_js_reverse.views.urls_js, name="js_reverse"),
    path("api/", include(router.urls), name="api"),
    path("api/", include("organizations.api_urls")),
    path("api/", include("inventory.api_urls")),
    path("api/", include("medical.api_urls")),
    path("api/", include("logistics.api_urls")),
    path("api/", include("instrumental.api_urls")),
    # drf-spectacular
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/schema/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

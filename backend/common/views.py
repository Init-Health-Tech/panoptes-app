from urllib.parse import urlparse

from django.conf import settings
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import LoginView, LogoutView
from django.utils.http import url_has_allowed_host_and_scheme
from django.views import generic

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .forms import PanoptesAuthenticationForm
from .serializers import MessageSerializer

SPA_ROUTE_NAMES = [
    "inventory",
    "supply-kits",
    "procedures",
    "doctors",
    "technicians",
    "products",
    "clients",
    "providers",
    "requisitions",
    "sales-orders",
    "purchase-orders",
    "instrumental",
    "instrumental-contracts",
    "instrumental-requests",
    "instrumental-quotations",
    "instrumental-fulfillment",
    "instrumental-handheld",
    "platform",
    "users",
]


class HomeView(generic.TemplateView):
    """Landing pública o dashboard React según autenticación."""

    def get_template_names(self):
        if self.request.user.is_authenticated:
            return ["common/index.html"]
        return ["panoptes/landing.html"]

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return super().dispatch(request, *args, **kwargs)
        return generic.TemplateView.dispatch(self, request, *args, **kwargs)


class AppView(LoginRequiredMixin, generic.TemplateView):
    template_name = "common/index.html"
    login_url = "/login/"


class PanoptesLoginView(LoginView):
    template_name = "panoptes/login.html"
    authentication_form = PanoptesAuthenticationForm
    redirect_authenticated_user = True

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        default_next = getattr(settings, "FRONTEND_URL", "") or "/"
        context["next"] = self.request.POST.get("next") or self.request.GET.get("next", default_next)
        return context

    def _allowed_hosts(self):
        hosts = {self.request.get_host()}
        frontend = getattr(settings, "FRONTEND_URL", "") or ""
        if frontend:
            hosts.add(urlparse(frontend).netloc)
        return hosts

    def get_success_url(self):
        redirect_to = self.request.POST.get("next") or self.request.GET.get("next")
        if redirect_to and url_has_allowed_host_and_scheme(
            url=redirect_to,
            allowed_hosts=self._allowed_hosts(),
            require_https=self.request.is_secure(),
        ):
            return redirect_to
        return getattr(settings, "FRONTEND_URL", "") or "/"


class PanoptesLogoutView(LogoutView):
    def get_success_url_allowed_hosts(self):
        hosts = set(super().get_success_url_allowed_hosts())
        frontend = getattr(settings, "FRONTEND_URL", "") or ""
        if frontend:
            hosts.add(urlparse(frontend).netloc)
        return hosts

    def get_default_redirect_url(self):
        return getattr(settings, "FRONTEND_URL", "") or "/"


class RestViewSet(viewsets.ViewSet):
    serializer_class = MessageSerializer

    @extend_schema(
        summary="Check REST API",
        description="This endpoint checks if the REST API is working.",
        examples=[
            OpenApiExample(
                "Successful Response",
                value={
                    "message": "This message comes from the backend. "
                    "If you're seeing this, the REST API is working!"
                },
                response_only=True,
            )
        ],
        methods=["GET"],
    )
    @action(
        detail=False,
        methods=["get"],
        permission_classes=[AllowAny],
        url_path="rest-check",
    )
    def rest_check(self, request):
        serializer = self.serializer_class(
            data={
                "message": "This message comes from the backend. "
                "If you're seeing this, the REST API is working!"
            }
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

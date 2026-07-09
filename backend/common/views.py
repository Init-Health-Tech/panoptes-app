from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import LoginView, LogoutView
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
    "products",
    "requisitions",
    "sales-orders",
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
        context["next"] = self.request.POST.get("next") or self.request.GET.get("next", "/")
        return context

    def get_success_url(self):
        redirect_to = self.request.POST.get("next") or self.request.GET.get("next")
        if redirect_to:
            return redirect_to
        return "/"


class PanoptesLogoutView(LogoutView):
    next_page = "/"


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

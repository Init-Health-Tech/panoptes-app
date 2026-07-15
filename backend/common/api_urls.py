from django.urls import path

from .api_views import CsrfView, CurrentUserView, LoginView, LogoutView


app_name = "common_api"

urlpatterns = [
    path("csrf/", CsrfView.as_view(), name="csrf"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("user/", CurrentUserView.as_view(), name="user"),
]

from django.urls import path

from . import views


app_name = "common"

urlpatterns = [
    path("", views.HomeView.as_view(), name="landing"),
    path("login/", views.PanoptesLoginView.as_view(), name="login"),
    path("logout/", views.PanoptesLogoutView.as_view(), name="logout"),
]

for route_name in views.SPA_ROUTE_NAMES:
    urlpatterns.append(path(f"{route_name}/", views.AppView.as_view(), name=route_name))
    urlpatterns.append(path(route_name, views.AppView.as_view()))

# Alias histórico del boilerplate
urlpatterns.append(path("users/", views.AppView.as_view(), name="index"))

from django.urls import path, re_path

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

urlpatterns.append(re_path(r"^inventory/\d+/?$", views.AppView.as_view(), name="inventory-detail"))
urlpatterns.append(
    re_path(
        r"^instrumental/\d+/(?:load|event)/?$",
        views.AppView.as_view(),
        name="instrumental-detail-action",
    )
)

# Alias histórico del boilerplate
urlpatterns.append(path("users/", views.AppView.as_view(), name="index"))

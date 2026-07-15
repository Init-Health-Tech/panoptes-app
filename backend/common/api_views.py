"""JSON auth endpoints for the React SPA (session-based, cross-origin friendly).

The SPA (served from Vercel) authenticates against these endpoints instead of the
Django-rendered login page. Auth stays session-based:

- ``GET  /api/auth/csrf/``  -> sets the ``csrftoken`` cookie and returns the token in
  the body so the SPA can send it as ``X-CSRFToken`` without reading ``document.cookie``
  (needed when the SPA runs on a different origin, e.g. ``*.vercel.app``).
- ``POST /api/auth/login/`` -> authenticates and opens a session (anonymous, CSRF-exempt).
- ``POST /api/auth/logout/`` -> closes the session (requires CSRF, sent by the SPA).
- ``GET  /api/auth/user/``  -> current user, or 401 if not authenticated.
"""

from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


def user_payload(user):
    return {
        "id": user.id,
        "email": user.email,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "is_platform_admin": bool(
            user.is_superuser or getattr(user, "is_platform_admin", False)
        ),
    }


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Bootstrap CSRF: set the cookie and hand the token back in the body."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        if not email or not password:
            return Response(
                {"detail": "Email y contraseña son obligatorios."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = authenticate(request, username=email, password=password)
        if user is None:
            return Response(
                {"detail": "Credenciales incorrectas."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, user)
        return Response(user_payload(user))


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(user_payload(request.user))

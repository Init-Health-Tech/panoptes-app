from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    """INIT operators: Django superuser (or staff with is_platform_admin if present)."""

    message = "Solo administradores de plataforma INIT pueden realizar esta acción."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return bool(getattr(user, "is_platform_admin", False))

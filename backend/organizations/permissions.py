from rest_framework.permissions import BasePermission

from organizations.models import OrganizationRole
from organizations.utils import (
    get_user_organization,
    organization_has_any_active_module,
)


def has_module_and_role(module_code, allowed_roles=None):
    """Factory for a reusable DRF permission class (module + role gate).

    ``module_code`` may be a string or a sequence of codes (any match grants access).

    Usage on a view::

        permission_classes = [IsAuthenticated, has_module_and_role("inventory_realtime")]
        permission_classes = [
            IsAuthenticated,
            has_module_and_role(("medical_kits", "instrumental_control")),
        ]
    """
    if allowed_roles is None:
        allowed_roles = OrganizationRole.all_values()
    else:
        allowed_roles = list(allowed_roles)

    codes = (module_code,) if isinstance(module_code, str) else tuple(module_code)
    label = "_".join(codes)

    class HasModuleAndRole(BasePermission):
        message = "Your organization does not have access to this module or your role is not permitted."

        def has_permission(self, request, view):
            user = request.user
            if not user or not user.is_authenticated:
                return False

            membership = getattr(request, "organization_membership", None)
            if membership is None:
                membership = get_user_organization(user)
            if membership is None:
                return False

            organization = membership.organization
            if not organization.is_active:
                return False

            if membership.role not in allowed_roles:
                return False

            return organization_has_any_active_module(organization, codes)

    HasModuleAndRole.__name__ = f"HasModuleAndRole_{label}"
    HasModuleAndRole.__qualname__ = HasModuleAndRole.__name__
    return HasModuleAndRole


def has_module_and_role_for_view(kwarg_name="module_code", allowed_roles=None):
    """Factory for permissions that read the module code from URL kwargs at request time."""
    if allowed_roles is None:
        allowed_roles = OrganizationRole.all_values()
    else:
        allowed_roles = list(allowed_roles)

    class HasModuleAndRoleForView(BasePermission):
        message = "Your organization does not have access to this module or your role is not permitted."

        def has_permission(self, request, view):
            module_code = view.kwargs.get(kwarg_name)
            if not module_code:
                return False

            user = request.user
            if not user or not user.is_authenticated:
                return False

            membership = getattr(request, "organization_membership", None)
            if membership is None:
                membership = get_user_organization(user)
            if membership is None:
                return False

            organization = membership.organization
            if not organization.is_active:
                return False

            if membership.role not in allowed_roles:
                return False

            return organization_has_any_active_module(organization, module_code)

    HasModuleAndRoleForView.__name__ = f"HasModuleAndRoleForView_{kwarg_name}"
    HasModuleAndRoleForView.__qualname__ = HasModuleAndRoleForView.__name__
    return HasModuleAndRoleForView

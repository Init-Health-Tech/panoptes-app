from rest_framework.exceptions import PermissionDenied


class OrganizationViewSetMixin:
    """Filter querysets and assign organization on create for tenant-scoped models."""

    organization_field = "organization"

    def get_organization(self):
        organization = getattr(self.request, "organization", None)
        if organization is None:
            raise PermissionDenied("User is not assigned to an organization.")
        return organization

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.for_organization(self.get_organization())

    def perform_create(self, serializer):
        serializer.save(**{self.organization_field: self.get_organization()})

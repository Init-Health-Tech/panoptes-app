def get_user_organization(user):
    """Return the user's primary membership (first by creation order).

    Supports future multi-org selection; callers should use this helper rather
    than querying memberships directly.
    """
    if user is None or not user.is_authenticated:
        return None
    return user.organization_memberships.select_related("organization").order_by("created").first()


def get_user_organization_or_none(user):
    membership = get_user_organization(user)
    return membership.organization if membership else None


def organization_has_active_module(organization, module_code: str) -> bool:
    if organization is None:
        return False
    return organization.organization_modules.filter(
        is_active=True,
        module__code=module_code,
    ).exists()

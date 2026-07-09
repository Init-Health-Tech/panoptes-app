from organizations.utils import get_user_organization


class OrganizationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.organization = None
        request.organization_membership = None

        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            membership = get_user_organization(user)
            if membership is not None:
                request.organization = membership.organization
                request.organization_membership = membership

        return self.get_response(request)

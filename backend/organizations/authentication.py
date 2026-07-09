from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from organizations.models import OrganizationAPIKey


API_KEY_HEADER = "HTTP_X_ORGANIZATION_API_KEY"


class OrganizationAPIKeyAuthentication(BaseAuthentication):
    """Authenticate RFID gateway webhooks via organization API key."""

    def authenticate(self, request):
        raw_key = request.META.get(API_KEY_HEADER)
        if not raw_key:
            return None

        api_key = OrganizationAPIKey.authenticate(raw_key)
        if api_key is None:
            raise AuthenticationFailed("Invalid or inactive organization API key.")

        request.organization = api_key.organization
        return (None, api_key)

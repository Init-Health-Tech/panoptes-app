from django.core.management import call_command
from django.test import TestCase

from users.models import User

from organizations.models import (
    Module,
    Organization,
    OrganizationMembership,
    OrganizationRole,
)
from organizations.utils import get_user_organization, organization_has_active_module


class OrganizationUtilsTest(TestCase):
    def setUp(self):
        call_command("seed_modules")
        self.organization = Organization.objects.create(name="Test Org", slug="test-org")
        self.user = User.objects.create_user(email="member@test.com", password="123456")
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.organization,
            role=OrganizationRole.TECHNICIAN,
        )
        self.inventory = Module.objects.get(code="inventory_realtime")

    def test_get_user_organization_returns_first_membership(self):
        membership = get_user_organization(self.user)
        self.assertEqual(membership.organization, self.organization)
        self.assertEqual(membership.role, OrganizationRole.TECHNICIAN)

    def test_organization_has_active_module(self):
        from organizations.models import OrganizationModule

        self.assertFalse(organization_has_active_module(self.organization, "inventory_realtime"))
        OrganizationModule.objects.create(
            organization=self.organization,
            module=self.inventory,
            is_active=True,
        )
        self.assertTrue(organization_has_active_module(self.organization, "inventory_realtime"))

    def test_user_organization_property(self):
        self.assertEqual(self.user.organization, self.organization)
        self.assertEqual(self.user.role, OrganizationRole.TECHNICIAN)

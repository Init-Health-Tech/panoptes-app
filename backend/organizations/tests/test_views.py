from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from common.utils.tests import TestCaseUtils
from model_bakery import baker
from rest_framework.test import APITestCase
from users.models import User

from organizations.models import (
    Module,
    Organization,
    OrganizationAPIKey,
    OrganizationMembership,
    OrganizationModule,
    OrganizationRole,
)


class SeedModulesCommandTest(APITestCase):
    def test_seed_modules_is_idempotent(self):
        call_command("seed_modules")
        count = Module.objects.count()
        call_command("seed_modules")
        self.assertEqual(Module.objects.count(), count)
        self.assertTrue(Module.objects.filter(code="inventory_realtime").exists())


class ActiveModulesViewTest(TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        call_command("seed_modules")
        self.organization = baker.make(Organization, slug="org-a", is_active=True)
        self.other_organization = baker.make(Organization, slug="org-b", is_active=True)
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.organization,
            role=OrganizationRole.ADMIN,
        )
        inventory = Module.objects.get(code="inventory_realtime")
        logistics = Module.objects.get(code="logistics_catalog")
        OrganizationModule.objects.create(
            organization=self.organization,
            module=inventory,
            is_active=True,
        )
        OrganizationModule.objects.create(
            organization=self.other_organization,
            module=logistics,
            is_active=True,
        )

    def test_returns_only_active_modules_for_user_organization(self):
        response = self.auth_client.get(reverse("active-modules"))

        self.assertResponse200(response)
        self.assertIn("inventory_realtime", response.data["modules"])
        self.assertNotIn("logistics_catalog", response.data["modules"])
        self.assertEqual(response.data["role"], OrganizationRole.ADMIN)
        self.assertEqual(response.data["organization"]["slug"], "org-a")

    def test_user_without_membership_gets_empty_modules(self):
        user = baker.make(User)
        user.set_password("123456")
        user.save()

        self.auth_client.logout()
        self.auth_client.login(email=user.email, password="123456")

        response = self.auth_client.get(reverse("active-modules"))

        self.assertResponse200(response)
        self.assertEqual(response.data["modules"], [])
        self.assertIsNone(response.data["organization"])


class HasModuleAndRolePermissionTest(TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        call_command("seed_modules")
        self.organization = baker.make(Organization, slug="probe-org", is_active=True)
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.organization,
            role=OrganizationRole.WAREHOUSE,
        )
        self.inventory = Module.objects.get(code="inventory_realtime")
        self.medical = Module.objects.get(code="medical_kits")

    def test_probe_returns_200_when_module_active(self):
        OrganizationModule.objects.create(
            organization=self.organization,
            module=self.inventory,
            is_active=True,
        )

        response = self.auth_client.get(
            reverse("module-probe", kwargs={"module_code": "inventory_realtime"})
        )

        self.assertResponse200(response)
        self.assertEqual(response.data["module"], "inventory_realtime")

    def test_probe_returns_403_when_module_disabled(self):
        OrganizationModule.objects.create(
            organization=self.organization,
            module=self.inventory,
            is_active=False,
        )

        response = self.auth_client.get(
            reverse("module-probe", kwargs={"module_code": "inventory_realtime"})
        )

        self.assertResponse403(response)

    def test_probe_returns_403_for_module_not_assigned_to_organization(self):
        response = self.auth_client.get(
            reverse("module-probe", kwargs={"module_code": "medical_kits"})
        )

        self.assertResponse403(response)

    def test_other_organization_modules_are_not_leaked_via_probe(self):
        other_org = baker.make(Organization, slug="other-org", is_active=True)
        OrganizationModule.objects.create(
            organization=other_org,
            module=self.medical,
            is_active=True,
        )

        response = self.auth_client.get(
            reverse("module-probe", kwargs={"module_code": "medical_kits"})
        )

        self.assertResponse403(response)


class OrganizationAPIKeyTest(TestCaseUtils, APITestCase):
    def setUp(self):
        super().setUp()
        self.organization = baker.make(Organization, slug="api-org", is_active=True)

    def test_generate_and_authenticate_api_key(self):
        api_key, raw_key = OrganizationAPIKey.generate_key(self.organization)

        self.assertTrue(api_key.is_active)
        self.assertEqual(api_key.prefix, raw_key[:8])

        authenticated = OrganizationAPIKey.authenticate(raw_key)
        self.assertIsNotNone(authenticated)
        self.assertEqual(authenticated.organization, self.organization)
        authenticated.refresh_from_db()
        self.assertIsNotNone(authenticated.last_used_at)

    def test_rotate_deactivates_previous_key(self):
        first_key, first_raw = OrganizationAPIKey.generate_key(self.organization)
        second_key, second_raw = OrganizationAPIKey.rotate_key(self.organization)

        first_key.refresh_from_db()
        self.assertFalse(first_key.is_active)
        self.assertIsNotNone(first_key.rotated_at)
        self.assertTrue(second_key.is_active)
        self.assertIsNone(OrganizationAPIKey.authenticate(first_raw))
        self.assertIsNotNone(OrganizationAPIKey.authenticate(second_raw))

    def test_invalid_api_key_returns_none(self):
        OrganizationAPIKey.generate_key(self.organization)
        self.assertIsNone(OrganizationAPIKey.authenticate("invalid-key-value"))


class OrganizationAdminTest(TestCase):
    def test_superuser_can_access_organization_admin(self):
        from django.contrib.auth import get_user_model
        from django.test import Client

        User = get_user_model()
        admin_user = User.objects.create_superuser(email="admin@test.com", password="123456")
        client = Client()
        client.force_login(admin_user)

        response = client.get("/admin/organizations/organization/")

        self.assertEqual(response.status_code, 200)

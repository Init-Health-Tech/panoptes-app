from django.urls import reverse

from model_bakery import baker
from rest_framework.test import APITestCase


class AuthApiTest(APITestCase):
    def setUp(self):
        self.password = "demo-pass-123"
        self.user = baker.prepare("users.User", email="demo@init.health")
        self.user.set_password(self.password)
        self.user.save()

    def test_csrf_endpoint_returns_token(self):
        response = self.client.get(reverse("common_api:csrf"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("csrfToken"))
        self.assertIn("csrftoken", response.cookies)

    def test_login_success(self):
        response = self.client.post(
            reverse("common_api:login"),
            {"email": self.user.email, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], self.user.email)

    def test_login_accepts_username_alias(self):
        response = self.client.post(
            reverse("common_api:login"),
            {"username": self.user.email, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_login_wrong_password(self):
        response = self.client.post(
            reverse("common_api:login"),
            {"email": self.user.email, "password": "nope"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_login_missing_fields(self):
        response = self.client.post(reverse("common_api:login"), {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_current_user_requires_auth(self):
        response = self.client.get(reverse("common_api:user"))
        self.assertIn(response.status_code, (401, 403))

    def test_login_then_current_user_and_logout(self):
        self.client.post(
            reverse("common_api:login"),
            {"email": self.user.email, "password": self.password},
            format="json",
        )
        me = self.client.get(reverse("common_api:user"))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["email"], self.user.email)

        logout = self.client.post(reverse("common_api:logout"))
        self.assertEqual(logout.status_code, 204)

        me_after = self.client.get(reverse("common_api:user"))
        self.assertIn(me_after.status_code, (401, 403))

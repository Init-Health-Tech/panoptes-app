from django import forms
from django.contrib.auth.forms import AuthenticationForm


class PanoptesAuthenticationForm(AuthenticationForm):
    username = forms.EmailField(
        label="Correo electrónico",
        widget=forms.EmailInput(
            attrs={
                "class": "panoptes-input",
                "placeholder": "demo@init.health",
                "autocomplete": "username",
            }
        ),
    )
    password = forms.CharField(
        label="Contraseña",
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "class": "panoptes-input",
                "placeholder": "••••••••",
                "autocomplete": "current-password",
            }
        ),
    )

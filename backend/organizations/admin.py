from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from organizations.models import (
    Module,
    Organization,
    OrganizationAPIKey,
    OrganizationMembership,
    OrganizationModule,
)


class OrganizationModuleInline(admin.TabularInline):
    model = OrganizationModule
    extra = 0
    autocomplete_fields = ["module"]


class OrganizationMembershipInline(admin.TabularInline):
    model = OrganizationMembership
    extra = 0
    autocomplete_fields = ["user"]


class OrganizationAPIKeyInline(admin.TabularInline):
    model = OrganizationAPIKey
    extra = 0
    readonly_fields = ("prefix", "key_hash", "last_used_at", "rotated_at", "created")
    fields = ("prefix", "is_active", "last_used_at", "rotated_at", "created")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "industry_type", "is_active", "created")
    list_filter = ("industry_type", "is_active")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [OrganizationModuleInline, OrganizationMembershipInline, OrganizationAPIKeyInline]
    actions = ["generate_api_key", "rotate_api_key"]

    @admin.action(description=_("Generate API key"))
    def generate_api_key(self, request, queryset):
        for organization in queryset:
            if not organization.api_keys.filter(is_active=True).exists():
                OrganizationAPIKey.generate_key(organization)

    @admin.action(description=_("Rotate API key"))
    def rotate_api_key(self, request, queryset):
        for organization in queryset:
            OrganizationAPIKey.rotate_key(organization)


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "created")
    search_fields = ("code", "name")
    readonly_fields = ("code", "name", "description", "created", "modified")


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role", "created")
    list_filter = ("role", "organization")
    search_fields = ("user__email", "organization__name")
    autocomplete_fields = ["user", "organization"]


@admin.register(OrganizationAPIKey)
class OrganizationAPIKeyAdmin(admin.ModelAdmin):
    list_display = ("organization", "prefix", "is_active", "last_used_at", "created")
    list_filter = ("is_active", "organization")
    search_fields = ("organization__name", "prefix")
    readonly_fields = ("prefix", "key_hash", "last_used_at", "rotated_at", "created", "modified")

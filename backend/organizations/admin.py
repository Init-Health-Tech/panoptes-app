from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from organizations.models import (
    Module,
    Organization,
    OrganizationAPIKey,
    OrganizationMembership,
    OrganizationModule,
    OrganizationProduct,
    PlatformAuditLog,
    ProductPackage,
    ProductPackageModule,
    UsageDailyRollup,
    UsageEvent,
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


class OrganizationProductInline(admin.TabularInline):
    model = OrganizationProduct
    extra = 0
    autocomplete_fields = ["package"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "slug",
        "account_type",
        "industry_type",
        "demo_expires_at",
        "demo_locked",
        "is_active",
        "created",
    )
    list_filter = ("account_type", "industry_type", "is_active", "demo_locked")
    search_fields = ("name", "slug", "contact_email", "contact_name")
    prepopulated_fields = {"slug": ("name",)}
    autocomplete_fields = ["sales_owner"]
    inlines = [
        OrganizationProductInline,
        OrganizationModuleInline,
        OrganizationMembershipInline,
        OrganizationAPIKeyInline,
    ]
    actions = ["generate_api_key", "rotate_api_key"]
    fieldsets = (
        (None, {"fields": ("name", "slug", "industry_type", "account_type", "is_active")}),
        (
            _("Contacto / ventas"),
            {"fields": ("contact_name", "contact_email", "sales_owner", "notes")},
        ),
        (
            _("Demo"),
            {"fields": ("demo_duration_days", "demo_expires_at", "demo_locked")},
        ),
    )

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


class ProductPackageModuleInline(admin.TabularInline):
    model = ProductPackageModule
    extra = 0
    autocomplete_fields = ["module"]


@admin.register(ProductPackage)
class ProductPackageAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_public", "created")
    list_filter = ("is_public",)
    search_fields = ("code", "name")
    inlines = [ProductPackageModuleInline]


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


@admin.register(UsageEvent)
class UsageEventAdmin(admin.ModelAdmin):
    list_display = ("organization", "method", "path", "ip_address", "module_code", "user", "created")
    list_filter = ("method", "module_code", "organization")
    search_fields = ("path", "ip_address", "organization__slug", "user__email")
    readonly_fields = (
        "organization",
        "user",
        "path",
        "method",
        "status_code",
        "ip_address",
        "module_code",
        "user_agent",
        "created",
        "modified",
    )


@admin.register(UsageDailyRollup)
class UsageDailyRollupAdmin(admin.ModelAdmin):
    list_display = ("organization", "day", "module_code", "request_count", "unique_users", "unique_ips")
    list_filter = ("day", "module_code", "organization")


@admin.register(PlatformAuditLog)
class PlatformAuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "organization", "actor", "created")
    list_filter = ("action",)
    search_fields = ("action", "organization__slug", "actor__email")
    readonly_fields = ("actor", "action", "organization", "payload", "created", "modified")

from django.contrib import admin

from medical.models import (
    Doctor,
    Procedure,
    ProcedureAssignment,
    SupplyKit,
    SupplyKitTag,
    Technician,
)


class ProcedureAssignmentInline(admin.TabularInline):
    model = ProcedureAssignment
    extra = 0


class SupplyKitTagInline(admin.TabularInline):
    model = SupplyKitTag
    extra = 0
    autocomplete_fields = ["tag"]


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ("name", "specialty", "hospital", "organization", "is_active")
    list_filter = ("is_active", "organization", "specialty")
    search_fields = ("name", "hospital")


@admin.register(Technician)
class TechnicianAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "is_active")
    list_filter = ("is_active", "organization")
    search_fields = ("name",)


@admin.register(Procedure)
class ProcedureAdmin(admin.ModelAdmin):
    list_display = ("procedure_type", "destination_hospital", "scheduled_date", "status", "organization")
    list_filter = ("status", "organization", "scheduled_date")
    search_fields = ("procedure_type", "destination_hospital")
    inlines = [ProcedureAssignmentInline]


@admin.register(ProcedureAssignment)
class ProcedureAssignmentAdmin(admin.ModelAdmin):
    list_display = ("procedure", "technician", "doctor", "role", "organization")
    list_filter = ("role", "organization")
    autocomplete_fields = ["procedure", "technician", "doctor"]


@admin.register(SupplyKit)
class SupplyKitAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "status", "destination_hospital", "organization", "shipped_at")
    list_filter = ("status", "organization")
    search_fields = ("code", "name", "destination_hospital")
    inlines = [SupplyKitTagInline]


@admin.register(SupplyKitTag)
class SupplyKitTagAdmin(admin.ModelAdmin):
    list_display = ("supply_kit", "tag", "organization")
    list_filter = ("organization",)
    autocomplete_fields = ["supply_kit", "tag"]

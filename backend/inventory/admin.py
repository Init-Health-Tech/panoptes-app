from django.contrib import admin

from inventory.models import InventoryLocation, RFIDReadEvent, RFIDTag


@admin.register(InventoryLocation)
class InventoryLocationAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "location_type", "is_active", "organization")
    list_filter = ("location_type", "is_active", "organization")
    search_fields = ("code", "name")
    readonly_fields = ("created", "modified")


@admin.register(RFIDTag)
class RFIDTagAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "item_type",
        "catalog_item",
        "lot",
        "expires_on",
        "status",
        "last_location",
        "inventory_location",
        "organization",
        "last_read_at",
    )
    list_filter = ("status", "organization", "item_type")
    search_fields = ("code", "last_location", "item_type", "lot")
    readonly_fields = ("created", "modified", "last_read_at")
    autocomplete_fields = ["catalog_item", "inventory_location"]


@admin.register(RFIDReadEvent)
class RFIDReadEventAdmin(admin.ModelAdmin):
    list_display = ("tag", "event_type", "location", "reader_source", "timestamp", "organization")
    list_filter = ("event_type", "organization")
    search_fields = ("tag__code", "location", "reader_source")
    readonly_fields = ("created", "modified")
    autocomplete_fields = ["tag"]

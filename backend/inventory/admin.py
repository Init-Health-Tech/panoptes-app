from django.contrib import admin

from inventory.models import RFIDReadEvent, RFIDTag


@admin.register(RFIDTag)
class RFIDTagAdmin(admin.ModelAdmin):
    list_display = ("code", "item_type", "status", "last_location", "organization", "last_read_at")
    list_filter = ("status", "organization", "item_type")
    search_fields = ("code", "last_location", "item_type")
    readonly_fields = ("created", "modified", "last_read_at")


@admin.register(RFIDReadEvent)
class RFIDReadEventAdmin(admin.ModelAdmin):
    list_display = ("tag", "event_type", "location", "reader_source", "timestamp", "organization")
    list_filter = ("event_type", "organization")
    search_fields = ("tag__code", "location", "reader_source")
    readonly_fields = ("created", "modified")
    autocomplete_fields = ["tag"]

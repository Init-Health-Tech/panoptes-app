from django.contrib import admin

from instrumental.models import (
    FulfillmentPlan,
    HandheldScanEvent,
    HospitalSite,
    InstrumentCatalogItem,
    InstrumentContractLine,
    InstrumentPriceContract,
    InstrumentProcedureRequest,
    InstrumentQuotation,
    MaterialDispatch,
    ProximityScheduleLink,
    TransportVehicle,
)


class InstrumentContractLineInline(admin.TabularInline):
    model = InstrumentContractLine
    extra = 1


@admin.register(InstrumentPriceContract)
class InstrumentPriceContractAdmin(admin.ModelAdmin):
    list_display = ("name", "doctor", "hospital", "is_active", "valid_from", "valid_to", "organization")
    list_filter = ("is_active", "organization")
    search_fields = ("name", "doctor__name", "hospital__name")
    inlines = [InstrumentContractLineInline]


admin.site.register(HospitalSite)


@admin.register(InstrumentCatalogItem)
class InstrumentCatalogItemAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "item_type", "category", "brand", "is_active", "organization")
    list_filter = ("item_type", "is_active", "organization")
    search_fields = ("sku", "name", "category", "brand")
    readonly_fields = ("created", "modified")


admin.site.register(TransportVehicle)
admin.site.register(InstrumentProcedureRequest)
admin.site.register(InstrumentQuotation)
admin.site.register(FulfillmentPlan)
admin.site.register(MaterialDispatch)
admin.site.register(HandheldScanEvent)
admin.site.register(ProximityScheduleLink)

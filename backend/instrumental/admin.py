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
admin.site.register(InstrumentCatalogItem)
admin.site.register(TransportVehicle)
admin.site.register(InstrumentProcedureRequest)
admin.site.register(InstrumentQuotation)
admin.site.register(FulfillmentPlan)
admin.site.register(MaterialDispatch)
admin.site.register(HandheldScanEvent)
admin.site.register(ProximityScheduleLink)

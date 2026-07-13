from instrumental.views import (
    FulfillmentPlanViewSet,
    HospitalSiteViewSet,
    InstrumentCatalogViewSet,
    InstrumentPriceContractViewSet,
    InstrumentProcedureRequestViewSet,
    InstrumentQuotationViewSet,
    MaterialDispatchViewSet,
    ProximityScheduleLinkViewSet,
    TransportVehicleViewSet,
)

routes = [
    {"regex": r"hospital-sites", "viewset": HospitalSiteViewSet, "basename": "hospital-site"},
    {"regex": r"instrument-catalog", "viewset": InstrumentCatalogViewSet, "basename": "instrument-catalog"},
    {
        "regex": r"instrument-price-contracts",
        "viewset": InstrumentPriceContractViewSet,
        "basename": "instrument-price-contract",
    },
    {"regex": r"transport-vehicles", "viewset": TransportVehicleViewSet, "basename": "transport-vehicle"},
    {
        "regex": r"instrument-procedure-requests",
        "viewset": InstrumentProcedureRequestViewSet,
        "basename": "instrument-procedure-request",
    },
    {"regex": r"instrument-quotations", "viewset": InstrumentQuotationViewSet, "basename": "instrument-quotation"},
    {"regex": r"fulfillment-plans", "viewset": FulfillmentPlanViewSet, "basename": "fulfillment-plan"},
    {"regex": r"material-dispatches", "viewset": MaterialDispatchViewSet, "basename": "material-dispatch"},
    {
        "regex": r"proximity-schedule-links",
        "viewset": ProximityScheduleLinkViewSet,
        "basename": "proximity-schedule-link",
    },
]

from logistics.views import (
    ClientViewSet,
    ProductViewSet,
    ProviderViewSet,
    PurchaseOrderViewSet,
    RequisitionViewSet,
    SalesOrderViewSet,
)


routes = [
    {"regex": r"products", "viewset": ProductViewSet, "basename": "product"},
    {"regex": r"clients", "viewset": ClientViewSet, "basename": "client"},
    {"regex": r"providers", "viewset": ProviderViewSet, "basename": "provider"},
    {"regex": r"requisitions", "viewset": RequisitionViewSet, "basename": "requisition"},
    {"regex": r"sales-orders", "viewset": SalesOrderViewSet, "basename": "sales-order"},
    {"regex": r"purchase-orders", "viewset": PurchaseOrderViewSet, "basename": "purchase-order"},
]

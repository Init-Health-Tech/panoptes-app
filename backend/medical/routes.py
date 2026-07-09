from medical.views import (
    DoctorViewSet,
    ProcedureAssignmentViewSet,
    ProcedureViewSet,
    SupplyKitViewSet,
    TechnicianViewSet,
)


routes = [
    {"regex": r"doctors", "viewset": DoctorViewSet, "basename": "doctor"},
    {"regex": r"technicians", "viewset": TechnicianViewSet, "basename": "technician"},
    {"regex": r"procedures", "viewset": ProcedureViewSet, "basename": "procedure"},
    {"regex": r"procedure-assignments", "viewset": ProcedureAssignmentViewSet, "basename": "procedure-assignment"},
    {"regex": r"supply-kits", "viewset": SupplyKitViewSet, "basename": "supply-kit"},
]

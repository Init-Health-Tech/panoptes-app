from inventory.views import InventoryLocationViewSet, RFIDReadEventViewSet, RFIDTagViewSet


routes = [
    {"regex": r"rfid-tags", "viewset": RFIDTagViewSet, "basename": "rfid-tag"},
    {"regex": r"rfid-read-events", "viewset": RFIDReadEventViewSet, "basename": "rfid-read-event"},
    {"regex": r"inventory-locations", "viewset": InventoryLocationViewSet, "basename": "inventory-location"},
]

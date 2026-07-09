from inventory.views import RFIDReadEventViewSet, RFIDTagViewSet


routes = [
    {"regex": r"rfid-tags", "viewset": RFIDTagViewSet, "basename": "rfid-tag"},
    {"regex": r"rfid-read-events", "viewset": RFIDReadEventViewSet, "basename": "rfid-read-event"},
]

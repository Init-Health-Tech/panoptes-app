from django.utils import timezone
from rest_framework import serializers

from inventory.custody import custody_payload_for_tag, get_open_custody
from inventory.models import RFIDReadEvent, RFIDTag, RFIDTagStatus


class RFIDTagSerializer(serializers.ModelSerializer):
    is_available = serializers.SerializerMethodField()
    custody_type = serializers.SerializerMethodField()
    custody_id = serializers.SerializerMethodField()
    custody_label = serializers.SerializerMethodField()
    custody_status = serializers.SerializerMethodField()

    class Meta:
        model = RFIDTag
        fields = [  # noqa: RUF012
            "id",
            "code",
            "item_type",
            "status",
            "last_location",
            "last_read_at",
            "is_available",
            "custody_type",
            "custody_id",
            "custody_label",
            "custody_status",
            "created",
            "modified",
        ]
        read_only_fields = (
            "last_read_at",
            "is_available",
            "custody_type",
            "custody_id",
            "custody_label",
            "custody_status",
            "created",
            "modified",
        )

    def _custody(self, obj):
        cache = self.context.setdefault("_custody_cache", {})
        if obj.id not in cache:
            cache[obj.id] = custody_payload_for_tag(obj)
        return cache[obj.id]

    def get_is_available(self, obj):
        return self._custody(obj)["is_available"]

    def get_custody_type(self, obj):
        return self._custody(obj)["custody_type"]

    def get_custody_id(self, obj):
        return self._custody(obj)["custody_id"]

    def get_custody_label(self, obj):
        return self._custody(obj)["custody_label"]

    def get_custody_status(self, obj):
        return self._custody(obj)["custody_status"]


class RFIDReadEventSerializer(serializers.ModelSerializer):
    tag_code = serializers.CharField(source="tag.code", read_only=True)

    class Meta:
        model = RFIDReadEvent
        fields = [  # noqa: RUF012
            "id",
            "tag",
            "tag_code",
            "timestamp",
            "location",
            "reader_source",
            "event_type",
            "created",
            "modified",
        ]
        read_only_fields = ("created", "modified")


class RFIDReadWebhookSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=128)
    location = serializers.CharField(max_length=255, required=False, allow_blank=True)
    reader_source = serializers.CharField(max_length=255, required=False, allow_blank=True)
    event_type = serializers.CharField(max_length=64)
    timestamp = serializers.DateTimeField(required=False)
    item_type = serializers.CharField(max_length=128, required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=RFIDTagStatus.choices,
        required=False,
    )

    def create(self, validated_data):
        organization = self.context["organization"]
        timestamp = validated_data.get("timestamp") or timezone.now()
        location = validated_data.get("location", "")
        status = validated_data.get("status")

        tag, created = RFIDTag.objects.get_or_create(
            organization=organization,
            code=validated_data["code"],
            defaults={
                "item_type": validated_data.get("item_type", ""),
                "status": status or RFIDTagStatus.EN_STOCK,
                "last_location": location,
                "last_read_at": timestamp,
            },
        )

        if not created:
            if validated_data.get("item_type"):
                tag.item_type = validated_data["item_type"]
            # Do not let webhook override status while tag is in open custody.
            if status and get_open_custody(tag) is None:
                tag.status = status
            if location:
                tag.last_location = location
            tag.last_read_at = timestamp
            tag.save()

        event = RFIDReadEvent.objects.create(
            organization=organization,
            tag=tag,
            timestamp=timestamp,
            location=location,
            reader_source=validated_data.get("reader_source", ""),
            event_type=validated_data["event_type"],
        )

        return {"tag": tag, "event": event, "created": created}

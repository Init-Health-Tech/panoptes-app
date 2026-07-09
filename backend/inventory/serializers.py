from django.utils import timezone
from rest_framework import serializers

from inventory.models import RFIDReadEvent, RFIDTag, RFIDTagStatus


class RFIDTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = RFIDTag
        fields = [  # noqa: RUF012
            "id",
            "code",
            "item_type",
            "status",
            "last_location",
            "last_read_at",
            "created",
            "modified",
        ]
        read_only_fields = ("last_read_at", "created", "modified")


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
            if status:
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

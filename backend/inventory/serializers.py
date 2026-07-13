from django.utils import timezone
from rest_framework import serializers

from inventory.custody import custody_payload_for_tag, get_open_custody
from inventory.models import InventoryLocation, RFIDReadEvent, RFIDTag, RFIDTagStatus
from inventory.rfid_code import RfidCodeError, hex_to_ascii_epc, normalize_rfid_code, rfid_code_variants


class InventoryLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryLocation
        fields = [  # noqa: RUF012
            "id",
            "name",
            "code",
            "location_type",
            "is_active",
            "created",
            "modified",
        ]
        read_only_fields = ("created", "modified")


class RFIDTagSerializer(serializers.ModelSerializer):
    is_available = serializers.SerializerMethodField()
    custody_type = serializers.SerializerMethodField()
    custody_id = serializers.SerializerMethodField()
    custody_label = serializers.SerializerMethodField()
    custody_status = serializers.SerializerMethodField()
    catalog_sku = serializers.CharField(source="catalog_item.sku", read_only=True, allow_null=True)
    catalog_name = serializers.CharField(source="catalog_item.name", read_only=True, allow_null=True)
    inventory_location_name = serializers.CharField(
        source="inventory_location.name",
        read_only=True,
        allow_null=True,
    )
    code_ascii = serializers.SerializerMethodField()

    class Meta:
        model = RFIDTag
        fields = [  # noqa: RUF012
            "id",
            "code",
            "code_ascii",
            "item_type",
            "catalog_item",
            "catalog_sku",
            "catalog_name",
            "lot",
            "expires_on",
            "status",
            "last_location",
            "inventory_location",
            "inventory_location_name",
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
            "code_ascii",
            "catalog_sku",
            "catalog_name",
            "inventory_location_name",
            "is_available",
            "custody_type",
            "custody_id",
            "custody_label",
            "custody_status",
            "created",
            "modified",
        )

    def validate_catalog_item(self, catalog_item):
        if catalog_item is None:
            return catalog_item
        organization = self.context.get("organization") or getattr(
            self.context.get("request"),
            "organization",
            None,
        )
        if organization and catalog_item.organization_id != organization.id:
            raise serializers.ValidationError("Catalog item must belong to your organization.")
        return catalog_item

    def validate_inventory_location(self, location):
        if location is None:
            return location
        organization = self.context.get("organization") or getattr(
            self.context.get("request"),
            "organization",
            None,
        )
        if organization and location.organization_id != organization.id:
            raise serializers.ValidationError("Location must belong to your organization.")
        return location

    def validate_code(self, value):
        organization = self.context.get("organization") or getattr(
            self.context.get("request"),
            "organization",
            None,
        )
        try:
            canonical = normalize_rfid_code(value, strict=True)
        except RfidCodeError as exc:
            raise serializers.ValidationError(str(exc)) from exc

        if organization:
            variants = rfid_code_variants(canonical)
            qs = RFIDTag.objects.filter(organization=organization, code__in=variants)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "Ya existe un tag con este EPC (hex o equivalente ASCII)."
                )
        return canonical

    def get_code_ascii(self, obj):
        return hex_to_ascii_epc(obj.code, strip_padding=True) if obj.code else None

    def create(self, validated_data):
        tag = RFIDTag(**validated_data)
        tag.sync_denormalized_fields()
        tag.save()
        return tag

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.sync_denormalized_fields()
        instance.save()
        return instance

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
        raw_code = validated_data["code"]

        try:
            canonical = normalize_rfid_code(raw_code, strict=False)
        except RfidCodeError:
            canonical = raw_code.strip()

        from inventory.rfid_code import find_rfid_tag_by_code

        tag = find_rfid_tag_by_code(
            RFIDTag.objects.filter(organization=organization),
            canonical,
        )
        created = tag is None

        if created:
            try:
                store_code = normalize_rfid_code(raw_code, strict=True)
            except RfidCodeError:
                store_code = canonical
            tag = RFIDTag.objects.create(
                organization=organization,
                code=store_code,
                item_type=validated_data.get("item_type", ""),
                status=status or RFIDTagStatus.EN_STOCK,
                last_location=location,
                last_read_at=timestamp,
            )
        else:
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

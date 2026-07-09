from django.contrib import admin

from logistics.models import (
    Client,
    Product,
    Provider,
    PurchaseOrder,
    PurchaseOrderLine,
    Requisition,
    RequisitionLine,
    SalesOrder,
    SalesOrderLine,
)


class RequisitionLineInline(admin.TabularInline):
    model = RequisitionLine
    extra = 0
    autocomplete_fields = ["product"]


class SalesOrderLineInline(admin.TabularInline):
    model = SalesOrderLine
    extra = 0
    autocomplete_fields = ["product"]


class PurchaseOrderLineInline(admin.TabularInline):
    model = PurchaseOrderLine
    extra = 0
    autocomplete_fields = ["product"]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "category", "unit", "organization")
    list_filter = ("category", "organization")
    search_fields = ("sku", "name")


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("business_name", "contact", "organization")
    list_filter = ("organization",)
    search_fields = ("business_name", "contact")


@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = ("business_name", "contact", "organization")
    list_filter = ("organization",)
    search_fields = ("business_name", "contact")


@admin.register(Requisition)
class RequisitionAdmin(admin.ModelAdmin):
    list_display = ("id", "origin", "destination", "status", "requested_at", "organization")
    list_filter = ("status", "organization")
    search_fields = ("origin", "destination")
    inlines = [RequisitionLineInline]


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ("id", "client", "status", "total", "ordered_at", "organization")
    list_filter = ("status", "organization")
    autocomplete_fields = ["client"]
    inlines = [SalesOrderLineInline]


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("id", "provider", "status", "total", "ordered_at", "organization")
    list_filter = ("status", "organization")
    autocomplete_fields = ["provider"]
    inlines = [PurchaseOrderLineInline]

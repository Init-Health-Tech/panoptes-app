MODULE_SEED_DATA = [
    {
        "code": "inventory_realtime",
        "name": "Inventario en tiempo real",
        "description": "Lecturas RFID e inventario en tiempo real.",
    },
    {
        "code": "medical_supplies",
        "name": "Procedimientos (instrumental)",
        "description": "Procedimientos del producto Control de instrumental.",
    },
    {
        "code": "medical_kits",
        "name": "Cargas RFID (instrumental)",
        "description": "Cargas/kits RFID del producto Control de instrumental.",
    },
    {
        "code": "medical_staff",
        "name": "Personal (instrumental)",
        "description": "Doctores y técnicos del producto Control de instrumental.",
    },
    {
        "code": "logistics_requisitions",
        "name": "Requisiciones logísticas",
        "description": "Requisiciones para envío de productos a ubicaciones.",
    },
    {
        "code": "logistics_sales_purchases",
        "name": "Ventas y compras",
        "description": "Órdenes de venta y compra.",
    },
    {
        "code": "logistics_catalog",
        "name": "Catálogos logísticos",
        "description": "Productos, clientes y proveedores.",
    },
    {
        "code": "instrumental_control",
        "name": "Control de instrumental",
        "description": "Producto unificado: solicitudes, cotizaciones, cargas RFID, despacho y validación.",
    },
]

# Product bundle: clinical org enables these together as one offering.
INSTRUMENTAL_PRODUCT_MODULES = (
    "instrumental_control",
    "medical_kits",
    "medical_supplies",
    "medical_staff",
)

PRODUCT_PACKAGE_SEED_DATA = [
    {
        "code": "pkg_instrumental",
        "name": "Control de instrumental",
        "description": "Flujo, cargas RFID, contratos, procedimientos y personal + inventario.",
        "modules": ["inventory_realtime", *INSTRUMENTAL_PRODUCT_MODULES],
    },
    {
        "code": "pkg_inventory",
        "name": "Inventario RFID",
        "description": "Solo inventario y lecturas en tiempo real.",
        "modules": ["inventory_realtime"],
    },
    {
        "code": "pkg_logistics",
        "name": "Logística comercial",
        "description": "Requisiciones, catálogos, ventas y compras + inventario.",
        "modules": [
            "inventory_realtime",
            "logistics_requisitions",
            "logistics_catalog",
            "logistics_sales_purchases",
        ],
    },
    {
        "code": "pkg_warehouse",
        "name": "Almacén y distribución",
        "description": (
            "Inventario RFID + requisiciones de entrada/salida entre almacenes "
            "+ catálogo (productos y proveedores). Sin ventas/compras."
        ),
        "modules": [
            "inventory_realtime",
            "logistics_requisitions",
            "logistics_catalog",
        ],
    },
    {
        "code": "pkg_full",
        "name": "Panoptes completo",
        "description": "Todos los módulos técnicos del catálogo.",
        "modules": [entry["code"] for entry in MODULE_SEED_DATA],
    },
]

export type NavSection = 'core' | 'instrumental' | 'logistics';

export type NavItem = {
  moduleCode: string;
  label: string;
  path: string;
  icon: string;
  section: NavSection;
};

/** Fine-grained codes that together form the Control de instrumental product. */
export const INSTRUMENTAL_PRODUCT_MODULES = [
  'instrumental_control',
  'medical_kits',
  'medical_supplies',
  'medical_staff',
] as const;

export const NAV_ITEMS: NavItem[] = [
  {
    moduleCode: 'inventory_realtime',
    label: 'Inventario',
    path: '/inventory',
    icon: 'sensors',
    section: 'core',
  },
  {
    moduleCode: 'inventory_realtime',
    label: 'Ubicaciones',
    path: '/inventory-locations',
    icon: 'location_on',
    section: 'core',
  },
  {
    moduleCode: 'instrumental_control',
    label: 'Flujo',
    path: '/instrumental',
    icon: 'timeline',
    section: 'instrumental',
  },
  {
    moduleCode: 'medical_kits',
    label: 'Cargas RFID',
    path: '/supply-kits',
    icon: 'medical_services',
    section: 'instrumental',
  },
  {
    moduleCode: 'instrumental_control',
    label: 'Catálogo',
    path: '/instrument-catalog',
    icon: 'category',
    section: 'instrumental',
  },
  {
    moduleCode: 'instrumental_control',
    label: 'Sedes',
    path: '/hospital-sites',
    icon: 'apartment',
    section: 'instrumental',
  },
  {
    moduleCode: 'instrumental_control',
    label: 'Vehículos',
    path: '/transport-vehicles',
    icon: 'local_shipping',
    section: 'instrumental',
  },
  {
    moduleCode: 'instrumental_control',
    label: 'Contratos',
    path: '/instrumental-contracts',
    icon: 'handshake',
    section: 'instrumental',
  },
  {
    moduleCode: 'medical_supplies',
    label: 'Procedimientos',
    path: '/procedures',
    icon: 'clinical_notes',
    section: 'instrumental',
  },
  {
    moduleCode: 'medical_staff',
    label: 'Doctores',
    path: '/doctors',
    icon: 'groups',
    section: 'instrumental',
  },
  {
    moduleCode: 'medical_staff',
    label: 'Técnicos',
    path: '/technicians',
    icon: 'engineering',
    section: 'instrumental',
  },
  {
    moduleCode: 'logistics_requisitions',
    label: 'Requisiciones',
    path: '/requisitions',
    icon: 'local_shipping',
    section: 'logistics',
  },
  {
    moduleCode: 'logistics_catalog',
    label: 'Productos',
    path: '/products',
    icon: 'category',
    section: 'logistics',
  },
  {
    moduleCode: 'logistics_catalog',
    label: 'Clientes',
    path: '/clients',
    icon: 'storefront',
    section: 'logistics',
  },
  {
    moduleCode: 'logistics_catalog',
    label: 'Proveedores',
    path: '/providers',
    icon: 'factory',
    section: 'logistics',
  },
  {
    moduleCode: 'logistics_sales_purchases',
    label: 'Ventas',
    path: '/sales-orders',
    icon: 'receipt_long',
    section: 'logistics',
  },
  {
    moduleCode: 'logistics_sales_purchases',
    label: 'Compras',
    path: '/purchase-orders',
    icon: 'shopping_cart',
    section: 'logistics',
  },
];

export const SECTION_LABELS: Record<NavSection, string> = {
  core: 'Core RFID',
  instrumental: 'Control de instrumental',
  logistics: 'Logístico',
};

export function hasInstrumentalProduct(activeModules: string[]): boolean {
  const moduleSet = new Set(activeModules);
  return INSTRUMENTAL_PRODUCT_MODULES.some((code) => moduleSet.has(code));
}

/** Nav visibility: product umbrella — instrumental_control unlocks the whole section. */
export function getNavItemsForModules(activeModules: string[]): NavItem[] {
  const moduleSet = new Set(activeModules);
  const productOn = hasInstrumentalProduct(activeModules);
  return NAV_ITEMS.filter((item) => {
    if (item.section === 'instrumental') {
      if (productOn && moduleSet.has('instrumental_control')) return true;
      return moduleSet.has(item.moduleCode);
    }
    return moduleSet.has(item.moduleCode);
  });
}

/** Route access: allow if any listed module is active (product family). */
export function hasModuleAccess(activeModules: string[], required: string | string[]): boolean {
  const needed = Array.isArray(required) ? required : [required];
  const moduleSet = new Set(activeModules);
  if (needed.some((code) => moduleSet.has(code))) return true;
  // Product flag unlocks medical surfaces of Control de instrumental
  if (
    moduleSet.has('instrumental_control') &&
    needed.some((code) =>
      (INSTRUMENTAL_PRODUCT_MODULES as readonly string[]).includes(code),
    )
  ) {
    return true;
  }
  return false;
}

export const ROUTE_MODULE_MAP: Record<string, string> = NAV_ITEMS.reduce(
  (acc, item) => {
    acc[item.path] = item.moduleCode;
    return acc;
  },
  { '/': 'inventory_realtime' } as Record<string, string>,
);

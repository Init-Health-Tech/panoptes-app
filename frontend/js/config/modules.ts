export type NavSection = 'core' | 'medical' | 'logistics';

export type NavItem = {
  moduleCode: string;
  label: string;
  path: string;
  icon: string;
  section: NavSection;
};

export const NAV_ITEMS: NavItem[] = [
  {
    moduleCode: 'inventory_realtime',
    label: 'Inventario',
    path: '/inventory',
    icon: 'sensors',
    section: 'core',
  },
  {
    moduleCode: 'medical_kits',
    label: 'Maletas',
    path: '/supply-kits',
    icon: 'medical_services',
    section: 'medical',
  },
  {
    moduleCode: 'medical_supplies',
    label: 'Procedimientos',
    path: '/procedures',
    icon: 'clinical_notes',
    section: 'medical',
  },
  {
    moduleCode: 'medical_staff',
    label: 'Directorio',
    path: '/doctors',
    icon: 'groups',
    section: 'medical',
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
    label: 'Catálogos',
    path: '/products',
    icon: 'category',
    section: 'logistics',
  },
  {
    moduleCode: 'logistics_sales_purchases',
    label: 'Ventas / Compras',
    path: '/sales-orders',
    icon: 'receipt_long',
    section: 'logistics',
  },
];

export const SECTION_LABELS: Record<NavSection, string> = {
  core: 'Core RFID',
  medical: 'Clínico',
  logistics: 'Logístico',
};

export function getNavItemsForModules(activeModules: string[]): NavItem[] {
  const moduleSet = new Set(activeModules);
  return NAV_ITEMS.filter((item) => moduleSet.has(item.moduleCode));
}

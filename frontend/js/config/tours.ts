export type TourStep = {
  /** CSS selector, preferably [data-tour="..."] */
  target: string;
  title: string;
  body: string;
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
};

export type TourDefinition = {
  id: string;
  title: string;
  steps: TourStep[];
};

export const TOURS: Record<string, TourDefinition> = {
  inventory: {
    id: 'inventory',
    title: 'Recorrido: Inventario RFID',
    steps: [
      {
        target: '[data-tour="page-title"]',
        title: 'Inventario',
        body: 'Aquí ves todos los tags RFID de tu organización: estado, ubicación y si están libres u ocupados.',
      },
      {
        target: '[data-tour="inventory-create"]',
        title: 'Registrar un tag',
        body: 'Crea tags manualmente con código, tipo de producto y ubicación. También llegan lecturas del gateway.',
      },
      {
        target: '[data-tour="inventory-filters"]',
        title: 'Filtros',
        body: 'Filtra por estado, ubicación o tipo para encontrar rápido un producto.',
      },
      {
        target: '[data-tour="inventory-table"]',
        title: 'Custodia',
        body: 'La columna Custodia indica si el tag está Libre o Ocupado en una carga/despacho. Un tag ocupado no se puede cargar en otro proceso.',
      },
    ],
  },
  'supply-kits': {
    id: 'supply-kits',
    title: 'Recorrido: Cargas RFID',
    steps: [
      {
        target: '[data-tour="page-title"]',
        title: 'Cargas RFID',
        body: 'Parte de Control de instrumental: armar → enviar → llegada hospital → regreso → llegada almacén. Cada carga sincroniza el inventario RFID.',
      },
      {
        target: '[data-tour="material-examples"]',
        title: 'Tipos de material',
        body: 'Puedes enviar equipo médico, consumibles e instrumental en la misma carga.',
      },
      {
        target: '[data-tour="kit-create"]',
        title: 'Nueva carga',
        body: 'Crea la carga y opcionalmente enlázala a un procedimiento con doctor.',
      },
      {
        target: '[data-tour="kit-list"]',
        title: 'Progreso por pasos',
        body: 'Cada tarjeta muestra el stepper: completado, en proceso o pendiente. Solo se cargan tags libres del inventario.',
      },
    ],
  },
  instrumental: {
    id: 'instrumental',
    title: 'Recorrido: Control de instrumental',
    steps: [
      {
        target: '[data-tour="page-title"]',
        title: 'Producto unificado',
        body: 'Flujo, cargas RFID, contratos, procedimientos y personal viven en el mismo producto: Control de instrumental.',
      },
      {
        target: '[data-tour="flow-actions"]',
        title: 'Accesos rápidos',
        body: 'Desde aquí creas solicitudes, abres cargas RFID, contratos o revisas inventario/custodia.',
      },
      {
        target: '[data-tour="flow-list"]',
        title: 'Casos en curso',
        body: 'Cada tarjeta es un caso. «Cargar material» abre una pantalla completa (mejor en celular); al terminar te pregunta si vuelves al flujo.',
      },
    ],
  },
  system: {
    id: 'system',
    title: 'Recorrido general del sistema',
    steps: [
      {
        target: '[data-tour="sidebar-brand"]',
        title: 'Panoptes',
        body: 'Plataforma RFID multi-producto. El menú lateral muestra solo lo activo en tu organización.',
      },
      {
        target: '[data-tour="nav-inventory"]',
        title: 'Inventario',
        body: 'Fuente de verdad de cada tag físico: libre u ocupado, estado y ubicación.',
      },
      {
        target: '[data-tour="nav-instrumental"]',
        title: 'Control de instrumental',
        body: 'Un solo producto: flujo operativo, cargas RFID, contratos, procedimientos y personal.',
      },
      {
        target: '[data-tour="page-title"]',
        title: 'Área de trabajo',
        body: 'Cada pantalla tiene su propio recorrido. Actívalo con el botón ? cuando lo necesites.',
      },
    ],
  },
};

export function tourStorageKey(tourId: string) {
  return `panoptes.tour.${tourId}.done`;
}

export function hasCompletedTour(tourId: string) {
  try {
    return localStorage.getItem(tourStorageKey(tourId)) === '1';
  } catch {
    return false;
  }
}

export function markTourCompleted(tourId: string) {
  try {
    localStorage.setItem(tourStorageKey(tourId), '1');
  } catch {
    /* ignore */
  }
}

export function resetTour(tourId: string) {
  try {
    localStorage.removeItem(tourStorageKey(tourId));
  } catch {
    /* ignore */
  }
}

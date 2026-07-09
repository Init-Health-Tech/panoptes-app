export type ActiveModules = {
  modules: string[];
  role: string | null;
  organization: {
    id: number;
    name: string;
    slug: string;
    industry_type: string;
    is_active: boolean;
  } | null;
};

export type RfidTagStatus = 'en_stock' | 'en_transito' | 'en_uso' | 'dado_de_baja';

export const RFID_STATUS_LABELS: Record<RfidTagStatus, string> = {
  en_stock: 'En stock',
  en_transito: 'En tránsito',
  en_uso: 'En uso',
  dado_de_baja: 'Dado de baja',
};

/** Basic examples of material that can be shipped with RFID tags. */
export const MATERIAL_CATEGORY_EXAMPLES = [
  {
    key: 'equipo',
    label: 'Equipo médico',
    icon: 'monitor_heart',
    examples: ['Monitor multiparámetros', 'Bomba de infusión'],
  },
  {
    key: 'consumibles',
    label: 'Consumibles',
    icon: 'vaccines',
    examples: ['Sutura Vicryl 3-0', 'Guantes estériles', 'Catéter guía 6F'],
  },
  {
    key: 'instrumental',
    label: 'Instrumental',
    icon: 'medical_services',
    examples: ['Pinza Kelly', 'Charola angioplastia', 'Endoscopio flexible'],
  },
] as const;

export const ITEM_TYPE_EXAMPLE_OPTIONS = [
  'Monitor multiparámetros',
  'Bomba de infusión',
  'Sutura Vicryl 3-0',
  'Guantes estériles 7.5',
  'Catéter guía 6F',
  'Pinza Kelly curva',
  'Charola angioplastia',
  'Endoscopio flexible',
] as const;

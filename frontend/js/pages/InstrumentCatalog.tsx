import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  instrumentCatalogCreate,
  instrumentCatalogPartialUpdate,
  type InstrumentCatalogItem,
  type ItemTypeEnum,
  type PaginatedInstrumentCatalogItemList,
} from '@/js/api';
import {
  instrumentCatalogImportTemplateDownload,
  instrumentCatalogImportUpload,
} from '@/js/api/bulkImport';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { BulkImportPanel } from '@/js/components/ui/BulkImportPanel';
import { Checkbox } from '@/js/components/ui/Checkbox';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { Select } from '@/js/components/ui/Select';
import { makeLink } from '@/js/utils';

const ITEM_TYPE_LABELS: Record<ItemTypeEnum, string> = {
  instrument: 'Instrumental',
  equipment: 'Equipo médico',
  tray: 'Charola',
  consumable: 'Consumible',
};

const ITEM_TYPE_OPTIONS = Object.entries(ITEM_TYPE_LABELS) as [ItemTypeEnum, string][];

function CatalogRow({
  item,
  onSaved,
}: {
  item: InstrumentCatalogItem;
  onSaved: () => void;
}) {
  const [sku, setSku] = useState(item.sku);
  const [name, setName] = useState(item.name);
  const [itemType, setItemType] = useState<ItemTypeEnum>(item.item_type);
  const [category, setCategory] = useState(item.category ?? '');
  const [brand, setBrand] = useState(item.brand ?? '');
  const [unit, setUnit] = useState(item.unit ?? 'pza');
  const [price, setPrice] = useState(item.default_unit_price ?? '');
  const [requiresSterilization, setRequiresSterilization] = useState(
    item.requires_sterilization ?? false,
  );
  const [isActive, setIsActive] = useState(item.is_active ?? true);

  const handleUpdate = async () => {
    await instrumentCatalogPartialUpdate({
      path: { id: item.id },
      body: {
        sku,
        name,
        item_type: itemType,
        category,
        brand,
        unit,
        default_unit_price: price === '' ? null : price,
        requires_sterilization: requiresSterilization,
        is_active: isActive,
      },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <tr className="panoptes-table-row">
      <td className="px-4 py-3 font-mono font-medium">{item.sku}</td>
      <td className="px-4 py-3">{item.name}</td>
      <td className="px-4 py-3 text-on-surface-variant">{ITEM_TYPE_LABELS[item.item_type]}</td>
      <td className="px-4 py-3 text-on-surface-variant">{item.category || '—'}</td>
      <td className="px-4 py-3 text-on-surface-variant">{item.brand || '—'}</td>
      <td className="px-4 py-3 text-on-surface-variant">{item.unit}</td>
      <td className="px-4 py-3 text-on-surface-variant">
        {item.default_unit_price != null ? `$${item.default_unit_price}` : '—'}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
            item.is_active
              ? 'bg-secondary-container/60 text-primary'
              : 'bg-surface-container-high text-on-surface-variant'
          }`}
        >
          {item.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-4 py-3">
        <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title="Editar producto">
          <FormField htmlFor={`sku-${item.id}`} label="SKU">
            <Input id={`sku-${item.id}`} onChange={(e) => setSku(e.target.value)} required value={sku} />
          </FormField>
          <FormField htmlFor={`name-${item.id}`} label="Nombre">
            <Input id={`name-${item.id}`} onChange={(e) => setName(e.target.value)} required value={name} />
          </FormField>
          <FormField htmlFor={`type-${item.id}`} label="Tipo">
            <Select
              id={`type-${item.id}`}
              onChange={(e) => setItemType(e.target.value as ItemTypeEnum)}
              value={itemType}
            >
              {ITEM_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField htmlFor={`cat-${item.id}`} label="Categoría">
            <Input id={`cat-${item.id}`} onChange={(e) => setCategory(e.target.value)} value={category} />
          </FormField>
          <FormField htmlFor={`brand-${item.id}`} label="Marca">
            <Input id={`brand-${item.id}`} onChange={(e) => setBrand(e.target.value)} value={brand} />
          </FormField>
          <FormField htmlFor={`unit-${item.id}`} label="Unidad">
            <Input id={`unit-${item.id}`} onChange={(e) => setUnit(e.target.value)} value={unit} />
          </FormField>
          <FormField htmlFor={`price-${item.id}`} label="Precio base">
            <Input
              id={`price-${item.id}`}
              onChange={(e) => setPrice(e.target.value)}
              step="0.01"
              type="number"
              value={price ?? ''}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Checkbox
              checked={requiresSterilization}
              onChange={(e) => setRequiresSterilization(e.target.checked)}
            />
            Requiere esterilización
          </label>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo
          </label>
        </EditFormPanel>
      </td>
    </tr>
  );
}

const InstrumentCatalog = () => {
  const data = useLoaderData<PaginatedInstrumentCatalogItemList>();
  const revalidator = useRevalidator();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<ItemTypeEnum>('instrument');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState('pza');
  const [price, setPrice] = useState('');
  const [requiresSterilization, setRequiresSterilization] = useState(false);

  const refresh = () => revalidator.revalidate();

  const handleCreate = async () => {
    await instrumentCatalogCreate({
      body: {
        sku,
        name,
        item_type: itemType,
        category,
        brand,
        unit,
        default_unit_price: price === '' ? null : price,
        requires_sterilization: requiresSterilization,
        is_active: true,
      },
      throwOnError: true,
    });
    setSku('');
    setName('');
    setItemType('instrument');
    setCategory('');
    setBrand('');
    setUnit('pza');
    setPrice('');
    setRequiresSterilization(false);
    refresh();
  };

  return (
    <AppLayout
      subtitle="SKU, tipo, categoría y marca para vincular unidades RFID"
      title="Catálogo de productos"
    >
      <div className="mb-2 flex flex-wrap gap-2">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Registrar producto" title="Nuevo producto">
        <FormField htmlFor="catalog-sku" label="SKU">
          <Input id="catalog-sku" onChange={(e) => setSku(e.target.value)} required value={sku} />
        </FormField>
        <FormField htmlFor="catalog-name" label="Nombre">
          <Input id="catalog-name" onChange={(e) => setName(e.target.value)} required value={name} />
        </FormField>
        <FormField htmlFor="catalog-type" label="Tipo">
          <Select
            id="catalog-type"
            onChange={(e) => setItemType(e.target.value as ItemTypeEnum)}
            value={itemType}
          >
            {ITEM_TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="catalog-category" label="Categoría">
          <Input
            id="catalog-category"
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ej. Cardiología"
            value={category}
          />
        </FormField>
        <FormField htmlFor="catalog-brand" label="Marca">
          <Input id="catalog-brand" onChange={(e) => setBrand(e.target.value)} value={brand} />
        </FormField>
        <FormField htmlFor="catalog-unit" label="Unidad">
          <Input id="catalog-unit" onChange={(e) => setUnit(e.target.value)} value={unit} />
        </FormField>
        <FormField htmlFor="catalog-price" label="Precio base">
          <Input
            id="catalog-price"
            onChange={(e) => setPrice(e.target.value)}
            step="0.01"
            type="number"
            value={price}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Checkbox
            checked={requiresSterilization}
            onChange={(e) => setRequiresSterilization(e.target.checked)}
          />
          Requiere esterilización
        </label>
      </FormPanel>
      <BulkImportPanel
        description="Descarga la plantilla, completa SKU/nombre/tipo e importa. SKUs duplicados (archivo o catálogo) se omiten con detalle por fila."
        onDownloadTemplate={instrumentCatalogImportTemplateDownload}
        onSuccess={refresh}
        onUpload={instrumentCatalogImportUpload}
        title="Carga masiva catálogo"
      />
      </div>

      <div className="panoptes-card overflow-hidden">
        <div className="panoptes-table-scroll overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="panoptes-table-header">SKU</th>
                <th className="panoptes-table-header">Nombre</th>
                <th className="panoptes-table-header">Tipo</th>
                <th className="panoptes-table-header">Categoría</th>
                <th className="panoptes-table-header">Marca</th>
                <th className="panoptes-table-header">Unidad</th>
                <th className="panoptes-table-header">Precio</th>
                <th className="panoptes-table-header">Estado</th>
                <th className="panoptes-table-header w-16"></th>
              </tr>
            </thead>
            <tbody>
              {data.results?.length ? (
                data.results.map((item) => (
                  <CatalogRow key={item.id} item={item} onSaved={refresh} />
                ))
              ) : (
                <tr>
                  <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={9}>
                    No hay productos en el catálogo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} productos</span>
        <div className="flex gap-2">
          {prev && (
            <Link className="panoptes-btn-primary" to={prev}>
              ← Anterior
            </Link>
          )}
          {next && (
            <Link className="panoptes-btn-primary" to={next}>
              Siguiente →
            </Link>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default InstrumentCatalog;

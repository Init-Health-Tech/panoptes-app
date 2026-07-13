import { Form, Link, useLoaderData, useRevalidator, useSearchParams } from 'react-router';
import { useState } from 'react';

import {
  instrumentCatalogCreate,
  rfidTagsCreate,
  type InstrumentCatalogItem,
  type InventoryLocation,
  type ItemTypeEnum,
  type PaginatedRfidTagList,
} from '@/js/api';
import {
  inventoryImportTemplateDownload,
  inventoryImportUpload,
} from '@/js/api/bulkImport';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { BulkImportPanel } from '@/js/components/ui/BulkImportPanel';
import { CustodyBadge } from '@/js/components/ui/CustodyBadge';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { Select } from '@/js/components/ui/Select';
import { StatusBadge } from '@/js/components/ui/StatusBadge';
import { makeLink } from '@/js/utils';
import { hexToAsciiEpc, syncFromAscii, syncFromHex, validateRfidCode } from '@/js/utils/rfidCode';
import type { RfidTagStatus } from '@/js/types/modules';
import { RFID_STATUS_LABELS } from '@/js/types/modules';

function tagAscii(tag: { code: string; code_ascii?: string | null }): string {
  return tag.code_ascii || hexToAsciiEpc(tag.code, { stripPadding: true }) || '—';
}

type InventoryLoaderData = PaginatedRfidTagList & {
  filters: { status: string; location: string; item_type: string };
  catalog: InstrumentCatalogItem[];
  locations: InventoryLocation[];
};

const STATUS_OPTIONS = Object.entries(RFID_STATUS_LABELS) as [RfidTagStatus, string][];

const ITEM_TYPE_OPTIONS: [ItemTypeEnum, string][] = [
  ['instrument', 'Instrumental'],
  ['equipment', 'Equipo médico'],
  ['tray', 'Charola'],
  ['consumable', 'Consumible'],
];

const CREATE_NEW = '__create_new__';

const Inventory = () => {
  const data = useLoaderData<InventoryLoaderData>();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [epcHex, setEpcHex] = useState('');
  const [asciiCode, setAsciiCode] = useState('');
  const [lot, setLot] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [catalogItemId, setCatalogItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [freeLocation, setFreeLocation] = useState('');
  const [itemType, setItemType] = useState('');
  const [status, setStatus] = useState<RfidTagStatus>('en_stock');
  const [codeError, setCodeError] = useState('');
  const [localCatalog, setLocalCatalog] = useState<InstrumentCatalogItem[]>([]);

  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newItemType, setNewItemType] = useState<ItemTypeEnum>('instrument');
  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');

  const refresh = () => revalidator.revalidate();
  const creatingNew = catalogItemId === CREATE_NEW;
  const catalogOptions = [...data.catalog, ...localCatalog.filter((item) => !data.catalog.some((c) => c.id === item.id))];

  const handleCreate = async () => {
    const rfidCheck = validateRfidCode(epcHex || asciiCode);
    if (!rfidCheck.ok) {
      setCodeError(rfidCheck.error ?? 'Código RFID inválido.');
      throw new Error(rfidCheck.error);
    }
    setCodeError('');

    let catalogId: number | null = catalogItemId && !creatingNew ? Number(catalogItemId) : null;
    let catalogName = catalogOptions.find((item) => item.id === catalogId)?.name || itemType;

    if (creatingNew) {
      if (!newSku.trim() || !newName.trim()) {
        throw new Error('SKU y nombre son obligatorios para el nuevo producto');
      }
      const created = await instrumentCatalogCreate({
        body: {
          sku: newSku.trim(),
          name: newName.trim(),
          item_type: newItemType,
          category: newCategory,
          brand: newBrand,
          unit: 'pza',
          is_active: true,
        },
        throwOnError: true,
      });
      catalogId = created.data.id;
      catalogName = created.data.name;
      setLocalCatalog((prevItems) => [...prevItems, created.data]);
    }

    const selectedLocation = data.locations.find((loc) => loc.id === Number(locationId));

    await rfidTagsCreate({
      body: {
        code: rfidCheck.canonicalHex ?? epcHex,
        catalog_item: catalogId,
        item_type: catalogName,
        inventory_location: locationId ? Number(locationId) : null,
        last_location: selectedLocation?.name || freeLocation,
        status,
        lot: lot.trim() || '',
        expires_on: expiresOn || null,
      },
      throwOnError: true,
    });
    setEpcHex('');
    setAsciiCode('');
    setCodeError('');
    setLot('');
    setExpiresOn('');
    setCatalogItemId('');
    setLocationId('');
    setFreeLocation('');
    setItemType('');
    setStatus('en_stock');
    setNewSku('');
    setNewName('');
    setNewItemType('instrument');
    setNewCategory('');
    setNewBrand('');
    refresh();
  };

  return (
    <AppLayout
      subtitle="Lecturas RFID en tiempo real — filtra por estado, ubicación o tipo"
      title="Inventario"
      tourId="inventory"
    >
      <div className="mb-2 flex flex-wrap gap-2">
        <div data-tour="inventory-create">
          <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Registrar tag" title="Nuevo tag RFID">
            <FormField htmlFor="tag-ascii" label="ASCII">
              <Input
                id="tag-ascii"
                maxLength={12}
                onChange={(e) => {
                  const synced = syncFromAscii(e.target.value);
                  setAsciiCode(synced.ascii);
                  setEpcHex(synced.hex);
                  setCodeError('');
                }}
                placeholder="ABCDEFGHIJKL"
                value={asciiCode}
              />
              <p className="mt-1 text-xs text-on-surface-variant">
                Hasta 12 caracteres. Si es más corto, se rellena con espacios (0x20) en el EPC.
              </p>
            </FormField>
            <FormField htmlFor="tag-epc" label="EPC (hex, 24 caracteres)">
              <Input
                id="tag-epc"
                maxLength={24}
                onChange={(e) => {
                  const synced = syncFromHex(e.target.value);
                  setEpcHex(synced.hex);
                  setAsciiCode(synced.ascii);
                  setCodeError('');
                }}
                placeholder="4142434445464748494A4B4C"
                value={epcHex}
              />
              <p className="mt-1 text-xs text-on-surface-variant">
                Siempre 24 caracteres hexadecimales. Al editarlo se actualiza el ASCII.
              </p>
              {codeError && <p className="mt-1 text-xs text-error">{codeError}</p>}
            </FormField>
            <FormField htmlFor="tag-catalog" label="Producto del catálogo">
              <Select
                id="tag-catalog"
                onChange={(e) => {
                  const value = e.target.value;
                  setCatalogItemId(value);
                  if (value === CREATE_NEW || !value) {
                    setItemType('');
                    return;
                  }
                  const selected = catalogOptions.find((item) => String(item.id) === value);
                  if (selected) setItemType(selected.name);
                }}
                value={catalogItemId}
              >
                <option value="">Sin producto (texto libre)</option>
                <option value={CREATE_NEW}>+ Crear nuevo producto…</option>
                {catalogOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.name}
                  </option>
                ))}
              </Select>
            </FormField>
            {creatingNew && (
              <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-semibold uppercase text-primary">Nuevo producto de catálogo</p>
                <FormField htmlFor="new-sku" label="SKU">
                  <Input id="new-sku" onChange={(e) => setNewSku(e.target.value)} required value={newSku} />
                </FormField>
                <FormField htmlFor="new-name" label="Nombre">
                  <Input id="new-name" onChange={(e) => setNewName(e.target.value)} required value={newName} />
                </FormField>
                <FormField htmlFor="new-type" label="Tipo">
                  <Select
                    id="new-type"
                    onChange={(e) => setNewItemType(e.target.value as ItemTypeEnum)}
                    value={newItemType}
                  >
                    {ITEM_TYPE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField htmlFor="new-category" label="Categoría">
                  <Input id="new-category" onChange={(e) => setNewCategory(e.target.value)} value={newCategory} />
                </FormField>
                <FormField htmlFor="new-brand" label="Marca">
                  <Input id="new-brand" onChange={(e) => setNewBrand(e.target.value)} value={newBrand} />
                </FormField>
              </div>
            )}
            {!catalogItemId && (
              <FormField htmlFor="tag-type" label="Tipo / descripción">
                <Input
                  id="tag-type"
                  onChange={(e) => setItemType(e.target.value)}
                  placeholder="Ej. Monitor, Sutura, Pinza Kelly…"
                  value={itemType}
                />
              </FormField>
            )}
            <FormField htmlFor="tag-location" label="Ubicación">
              {data.locations.length > 0 ? (
                <Select id="tag-location" onChange={(e) => setLocationId(e.target.value)} value={locationId}>
                  <option value="">Sin ubicación</option>
                  {data.locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="tag-location"
                  onChange={(e) => setFreeLocation(e.target.value)}
                  placeholder="Ej. Almacén central"
                  value={freeLocation}
                />
              )}
            </FormField>
            <FormField htmlFor="tag-lot" label="Lote (opcional)">
              <Input
                id="tag-lot"
                onChange={(e) => setLot(e.target.value)}
                placeholder="Ej. LOT-2026-A"
                value={lot}
              />
            </FormField>
            <FormField htmlFor="tag-expires" label="Caducidad (opcional)">
              <Input
                id="tag-expires"
                onChange={(e) => setExpiresOn(e.target.value)}
                type="date"
                value={expiresOn}
              />
            </FormField>
            <FormField htmlFor="tag-status" label="Estado">
              <Select id="tag-status" onChange={(e) => setStatus(e.target.value as RfidTagStatus)} value={status}>
                {STATUS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
          </FormPanel>
        </div>
        <BulkImportPanel
          description="Descarga la plantilla, llena códigos RFID (y opcionalmente catalog_sku / location_code) e importa. Los duplicados se omiten con detalle por fila."
          onDownloadTemplate={inventoryImportTemplateDownload}
          onSuccess={refresh}
          onUpload={inventoryImportUpload}
          title="Carga masiva inventario"
        />
      </div>

      <Form className="panoptes-card mb-6 grid gap-4 p-4 md:grid-cols-4" data-tour="inventory-filters" method="get">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">
            Estado
          </label>
          <select className="panoptes-input" defaultValue={data.filters.status} name="status">
            <option value="">Todos</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">
            Ubicación
          </label>
          <input
            className="panoptes-input"
            defaultValue={data.filters.location}
            name="location"
            placeholder="Ej. Almacén A"
            type="text"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">
            Tipo de item
          </label>
          <input
            className="panoptes-input"
            defaultValue={data.filters.item_type}
            name="item_type"
            placeholder="Ej. Sutura"
            type="text"
          />
        </div>
        <div className="flex items-end gap-2">
          <button className="panoptes-btn-primary w-full" type="submit">
            Filtrar
          </button>
          <Link className="panoptes-btn-secondary" to="/inventory">
            Limpiar
          </Link>
        </div>
        <input name="limit" type="hidden" value={searchParams.get('limit') || '20'} />
      </Form>

      <div className="panoptes-card overflow-hidden" data-tour="inventory-table">
        <div className="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">sensors</span>
            <span className="text-sm font-semibold">Tags RFID</span>
            <span className="rounded-full bg-secondary-container/50 px-2 py-0.5 text-xs font-semibold text-primary">
              {data.count} total
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs text-on-surface-variant">
            <span className="h-2 w-2 rounded-full bg-primary status-pulse" />
            Tiempo real
          </span>
        </div>

        <div className="panoptes-table-scroll overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="panoptes-table-header">Producto</th>
                <th className="panoptes-table-header">Estado</th>
                <th className="panoptes-table-header">Custodia</th>
                <th className="panoptes-table-header">Ubicación</th>
                <th className="panoptes-table-header">Última lectura</th>
                <th className="panoptes-table-header">RFID</th>
              </tr>
            </thead>
            <tbody>
              {data.results?.length ? (
                data.results.map((tag) => {
                  const ascii = tagAscii(tag as { code: string; code_ascii?: string | null });
                  return (
                  <tr key={tag.id} className="panoptes-table-row">
                    <td className="px-4 py-3 text-on-surface-variant">
                      <span className="block font-medium text-on-surface">
                        {tag.catalog_name || tag.item_type || '—'}
                      </span>
                      {(tag.catalog_sku || tag.lot || tag.expires_on) && (
                        <span className="mt-0.5 block space-y-0.5 text-[11px]">
                          {tag.catalog_sku && (
                            <span className="block font-mono">Código: {tag.catalog_sku}</span>
                          )}
                          {tag.lot && <span className="block">Lote: {tag.lot}</span>}
                          {tag.expires_on && (
                            <span className="block">
                              Caducidad:{' '}
                              {new Date(`${tag.expires_on}T12:00:00`).toLocaleDateString('es-MX')}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge pulse={tag.status === 'en_transito'} status={tag.status ?? 'en_stock'} />
                    </td>
                    <td className="px-4 py-3">
                      <CustodyBadge
                        custodyLabel={tag.custody_label}
                        custodyType={tag.custody_type}
                        isAvailable={tag.is_available}
                      />
                      {tag.custody_label && (
                        <p className="mt-1 max-w-[12rem] truncate text-[11px] text-on-surface-variant">
                          {tag.custody_label}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {tag.inventory_location_name || tag.last_location || '—'}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {tag.last_read_at
                        ? new Date(tag.last_read_at).toLocaleString('es-MX')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link className="block font-mono text-sm font-medium text-primary hover:underline" to={`/inventory/${tag.id}`}>
                        {ascii !== '—' ? ascii : tag.code}
                      </Link>
                      {ascii !== '—' && (
                        <span className="mt-0.5 block font-mono text-[11px] text-on-surface-variant">
                          EPC: {tag.code}
                        </span>
                      )}
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={6}>
                    No hay tags RFID registrados. Las lecturas del gateway aparecerán aquí.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-outline-variant/30 px-4 py-3 text-sm">
          <span className="text-on-surface-variant">
            {data.results?.length ?? 0} en esta página
          </span>
          <div className="flex gap-2">
            {!prev ? (
              <span className="panoptes-btn-primary pointer-events-none opacity-40">← Anterior</span>
            ) : (
              <Link className="panoptes-btn-primary" to={prev}>
                ← Anterior
              </Link>
            )}
            {!next ? (
              <span className="panoptes-btn-primary pointer-events-none opacity-40">Siguiente →</span>
            ) : (
              <Link className="panoptes-btn-primary" to={next}>
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Inventory;

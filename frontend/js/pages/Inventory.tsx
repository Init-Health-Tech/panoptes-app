import { Form, Link, useLoaderData, useRevalidator, useSearchParams } from 'react-router';
import { useState } from 'react';

import { rfidTagsCreate, type PaginatedRfidTagList } from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { CustodyBadge } from '@/js/components/ui/CustodyBadge';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { Select } from '@/js/components/ui/Select';
import { StatusBadge } from '@/js/components/ui/StatusBadge';
import { makeLink } from '@/js/utils';
import { ITEM_TYPE_EXAMPLE_OPTIONS } from '@/js/types/materialExamples';
import type { RfidTagStatus } from '@/js/types/modules';
import { RFID_STATUS_LABELS } from '@/js/types/modules';

type InventoryLoaderData = PaginatedRfidTagList & {
  filters: { status: string; location: string; item_type: string };
};

const STATUS_OPTIONS = Object.entries(RFID_STATUS_LABELS) as [RfidTagStatus, string][];

const Inventory = () => {
  const data = useLoaderData<InventoryLoaderData>();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [code, setCode] = useState('');
  const [itemType, setItemType] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<RfidTagStatus>('en_stock');

  const refresh = () => revalidator.revalidate();

  const handleCreate = async () => {
    await rfidTagsCreate({
      body: { code, item_type: itemType, last_location: location, status },
      throwOnError: true,
    });
    setCode('');
    setItemType('');
    setLocation('');
    setStatus('en_stock');
    refresh();
  };

  return (
    <AppLayout
      subtitle="Lecturas RFID en tiempo real — filtra por estado, ubicación o tipo"
      title="Inventario"
      tourId="inventory"
    >
      <div data-tour="inventory-create">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Registrar tag" title="Nuevo tag RFID">
        <FormField htmlFor="tag-code" label="Código RFID">
          <Input id="tag-code" onChange={(e) => setCode(e.target.value)} placeholder="EPC-001" required value={code} />
        </FormField>
        <FormField htmlFor="tag-type" label="Tipo de item">
          <Input
            id="tag-type"
            list="item-type-examples"
            onChange={(e) => setItemType(e.target.value)}
            placeholder="Ej. Monitor, Sutura, Pinza Kelly…"
            value={itemType}
          />
          <datalist id="item-type-examples">
            {ITEM_TYPE_EXAMPLE_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-on-surface-variant">
            Ejemplos: equipo médico, consumibles o instrumental.
          </p>
        </FormField>
        <FormField htmlFor="tag-location" label="Ubicación">
          <Input id="tag-location" onChange={(e) => setLocation(e.target.value)} value={location} />
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
                <th className="panoptes-table-header">Código RFID</th>
                <th className="panoptes-table-header">Tipo</th>
                <th className="panoptes-table-header">Estado</th>
                <th className="panoptes-table-header">Custodia</th>
                <th className="panoptes-table-header">Ubicación</th>
                <th className="panoptes-table-header">Última lectura</th>
              </tr>
            </thead>
            <tbody>
              {data.results?.length ? (
                data.results.map((tag) => (
                  <tr key={tag.id} className="panoptes-table-row">
                    <td className="px-4 py-3 font-mono text-sm font-medium">
                      <Link className="text-primary hover:underline" to={`/inventory/${tag.id}`}>
                        {tag.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{tag.item_type || '—'}</td>
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
                    <td className="px-4 py-3">{tag.last_location || '—'}</td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {tag.last_read_at
                        ? new Date(tag.last_read_at).toLocaleString('es-MX')
                        : '—'}
                    </td>
                  </tr>
                ))
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

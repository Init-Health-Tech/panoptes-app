import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  rfidTagsPartialUpdate,
  type PaginatedRfidReadEventList,
  type RfidTag,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { Input } from '@/js/components/ui/Input';
import { Select } from '@/js/components/ui/Select';
import { StatusBadge } from '@/js/components/ui/StatusBadge';
import type { RfidTagStatus } from '@/js/types/modules';
import { RFID_STATUS_LABELS } from '@/js/types/modules';

type InventoryDetailData = {
  tag: RfidTag;
  events: PaginatedRfidReadEventList;
};

const STATUS_OPTIONS = Object.entries(RFID_STATUS_LABELS) as [RfidTagStatus, string][];

const InventoryDetail = () => {
  const { tag, events } = useLoaderData<InventoryDetailData>();
  const revalidator = useRevalidator();
  const [itemType, setItemType] = useState(tag.item_type ?? '');
  const [location, setLocation] = useState(tag.last_location ?? '');
  const [status, setStatus] = useState<RfidTagStatus>(tag.status ?? 'en_stock');

  const refresh = () => revalidator.revalidate();

  const handleUpdate = async () => {
    await rfidTagsPartialUpdate({
      path: { id: tag.id },
      body: { item_type: itemType, last_location: location, status },
      throwOnError: true,
    });
    refresh();
  };

  return (
    <AppLayout subtitle={`Historial de lecturas y estado del tag ${tag.code}`} title="Detalle RFID">
      <div className="mb-4 flex items-center justify-between">
        <Link className="panoptes-btn-secondary inline-flex" to="/inventory">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver al inventario
        </Link>
        <EditFormPanel onSubmit={handleUpdate} onSuccess={refresh} title="Editar tag">
          <FormField htmlFor="edit-type" label="Tipo">
            <Input id="edit-type" onChange={(e) => setItemType(e.target.value)} value={itemType} />
          </FormField>
          <FormField htmlFor="edit-location" label="Ubicación">
            <Input id="edit-location" onChange={(e) => setLocation(e.target.value)} value={location} />
          </FormField>
          <FormField htmlFor="edit-status" label="Estado">
            <Select
              id="edit-status"
              onChange={(e) => setStatus(e.target.value as RfidTagStatus)}
              value={status}
            >
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </EditFormPanel>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="panoptes-card p-4">
          <p className="text-xs font-semibold uppercase text-on-surface-variant">Código</p>
          <p className="font-mono text-lg font-semibold">{tag.code}</p>
        </div>
        <div className="panoptes-card p-4">
          <p className="text-xs font-semibold uppercase text-on-surface-variant">Tipo</p>
          <p className="text-lg font-semibold">{tag.item_type || '—'}</p>
        </div>
        <div className="panoptes-card p-4">
          <p className="text-xs font-semibold uppercase text-on-surface-variant">Estado</p>
          <StatusBadge pulse={tag.status === 'en_transito'} status={tag.status ?? 'en_stock'} />
        </div>
        <div className="panoptes-card p-4">
          <p className="text-xs font-semibold uppercase text-on-surface-variant">Ubicación</p>
          <p className="text-lg font-semibold">{tag.last_location || '—'}</p>
        </div>
      </div>

      <div className="panoptes-card overflow-hidden">
        <div className="border-b border-outline-variant/30 px-4 py-3">
          <h2 className="text-sm font-semibold">Historial de lecturas</h2>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="panoptes-table-header">Fecha</th>
              <th className="panoptes-table-header">Ubicación</th>
              <th className="panoptes-table-header">Lector</th>
              <th className="panoptes-table-header">Evento</th>
            </tr>
          </thead>
          <tbody>
            {events.results?.length ? (
              events.results.map((event) => (
                <tr key={event.id} className="panoptes-table-row">
                  <td className="px-4 py-3 text-on-surface-variant">
                    {event.timestamp ? new Date(event.timestamp).toLocaleString('es-MX') : '—'}
                  </td>
                  <td className="px-4 py-3">{event.location || '—'}</td>
                  <td className="px-4 py-3">{event.reader_source || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{event.event_type}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={4}>
                  Sin lecturas registradas para este tag.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
};

export default InventoryDetail;

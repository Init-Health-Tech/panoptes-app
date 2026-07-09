import { Form, Link, useLoaderData, useSearchParams } from 'react-router';

import type { PaginatedRfidTagList } from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { StatusBadge } from '@/js/components/ui/StatusBadge';
import { makeLink } from '@/js/utils';
import type { RfidTagStatus } from '@/js/types/modules';
import { RFID_STATUS_LABELS } from '@/js/types/modules';

type InventoryLoaderData = PaginatedRfidTagList & {
  filters: { status: string; location: string; item_type: string };
};

const STATUS_OPTIONS = Object.entries(RFID_STATUS_LABELS) as [RfidTagStatus, string][];

const Inventory = () => {
  const data = useLoaderData<InventoryLoaderData>();
  const [searchParams] = useSearchParams();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);

  return (
    <AppLayout
      subtitle="Lecturas RFID en tiempo real — filtra por estado, ubicación o tipo"
      title="Inventario"
    >
      <Form className="panoptes-card mb-6 grid gap-4 p-4 md:grid-cols-4" method="get">
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

      <div className="panoptes-card overflow-hidden">
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

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="panoptes-table-header">Código RFID</th>
                <th className="panoptes-table-header">Tipo</th>
                <th className="panoptes-table-header">Estado</th>
                <th className="panoptes-table-header">Ubicación</th>
                <th className="panoptes-table-header">Última lectura</th>
              </tr>
            </thead>
            <tbody>
              {data.results?.length ? (
                data.results.map((tag) => (
                  <tr key={tag.id} className="panoptes-table-row">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{tag.code}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{tag.item_type || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge pulse={tag.status === 'en_transito'} status={tag.status ?? 'en_stock'} />
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
                  <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={5}>
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

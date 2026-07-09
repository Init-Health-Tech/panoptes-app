import { Form, Link, useLoaderData, useSearchParams } from 'react-router';

import type { PaginatedRequisitionList } from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';
import { REQUISITION_STATUS_LABELS } from '@/js/types/logistics';
import { makeLink } from '@/js/utils';

type RequisitionsLoaderData = PaginatedRequisitionList & {
  filters: { status: string };
};

const KANBAN_COLUMNS = ['solicitada', 'aprobada', 'en_transito', 'entregada'] as const;

const Requisitions = () => {
  const data = useLoaderData<RequisitionsLoaderData>();
  const [searchParams] = useSearchParams();
  const activeStatus = data.filters.status;
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);

  const grouped = KANBAN_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = (data.results ?? []).filter((r) => r.status === status);
      return acc;
    },
    {} as Record<string, NonNullable<typeof data.results>>,
  );

  return (
    <AppLayout
      subtitle="Requisiciones de envío entre ubicaciones"
      title="Requisiciones"
    >
      <Form className="panoptes-card mb-6 flex flex-wrap items-end gap-4 p-4" method="get">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">
            Filtrar por estado
          </label>
          <select className="panoptes-input" defaultValue={activeStatus} name="status">
            <option value="">Todos (vista kanban)</option>
            {Object.entries(REQUISITION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button className="panoptes-btn-primary" type="submit">
          Aplicar
        </button>
        <input name="limit" type="hidden" value={searchParams.get('limit') || '20'} />
      </Form>

      {!activeStatus ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {KANBAN_COLUMNS.map((status) => (
            <section key={status} className="panoptes-card p-4">
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase text-on-surface-variant">
                  {REQUISITION_STATUS_LABELS[status]}
                </h3>
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold">
                  {grouped[status]?.length ?? 0}
                </span>
              </header>
              <div className="space-y-2">
                {(grouped[status] ?? []).map((req) => (
                  <article
                    key={req.id}
                    className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-3"
                  >
                    <p className="text-xs font-semibold text-primary">REQ #{req.id}</p>
                    <p className="mt-1 text-sm font-medium">
                      {req.origin} → {req.destination}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {req.lines?.length ?? 0} productos
                    </p>
                  </article>
                ))}
                {!grouped[status]?.length && (
                  <p className="text-xs text-on-surface-variant">Sin requisiciones</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="panoptes-card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="panoptes-table-header">ID</th>
                <th className="panoptes-table-header">Origen</th>
                <th className="panoptes-table-header">Destino</th>
                <th className="panoptes-table-header">Estado</th>
                <th className="panoptes-table-header">Líneas</th>
              </tr>
            </thead>
            <tbody>
              {data.results?.map((req) => (
                <tr key={req.id} className="panoptes-table-row">
                  <td className="px-4 py-3 font-mono">#{req.id}</td>
                  <td className="px-4 py-3">{req.origin}</td>
                  <td className="px-4 py-3">{req.destination}</td>
                  <td className="px-4 py-3">
                    <KitStatusBadge labels={REQUISITION_STATUS_LABELS} status={req.status ?? 'solicitada'} />
                  </td>
                  <td className="px-4 py-3">{req.lines?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} requisiciones</span>
        <div className="flex gap-2">
          {prev && <Link className="panoptes-btn-primary" to={prev}>← Anterior</Link>}
          {next && <Link className="panoptes-btn-primary" to={next}>Siguiente →</Link>}
        </div>
      </div>
    </AppLayout>
  );
};

export default Requisitions;

import { Form, Link, useLoaderData, useSearchParams } from 'react-router';

import type { PaginatedProcedureList } from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';
import { PROCEDURE_STATUS_LABELS } from '@/js/types/medical';
import { makeLink } from '@/js/utils';

type ProceduresLoaderData = PaginatedProcedureList & {
  filters: { status: string };
};

const Procedures = () => {
  const data = useLoaderData<ProceduresLoaderData>();
  const [searchParams] = useSearchParams();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);

  return (
    <AppLayout subtitle="Procedimientos médicos programados" title="Procedimientos">
      <Form className="panoptes-card mb-6 flex flex-wrap items-end gap-4 p-4" method="get">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">
            Estado
          </label>
          <select className="panoptes-input" defaultValue={data.filters.status} name="status">
            <option value="">Todos</option>
            {Object.entries(PROCEDURE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button className="panoptes-btn-primary" type="submit">
          Filtrar
        </button>
        <input name="limit" type="hidden" value={searchParams.get('limit') || '20'} />
      </Form>

      <div className="panoptes-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="panoptes-table-header">Procedimiento</th>
              <th className="panoptes-table-header">Hospital</th>
              <th className="panoptes-table-header">Fecha</th>
              <th className="panoptes-table-header">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.results?.length ? (
              data.results.map((procedure) => (
                <tr key={procedure.id} className="panoptes-table-row">
                  <td className="px-4 py-3 font-medium">{procedure.procedure_type}</td>
                  <td className="px-4 py-3">{procedure.destination_hospital}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{procedure.scheduled_date}</td>
                  <td className="px-4 py-3">
                    <KitStatusBadge labels={PROCEDURE_STATUS_LABELS} status={procedure.status ?? 'scheduled'} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={4}>
                  No hay procedimientos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} procedimientos</span>
        <div className="flex gap-2">
          {prev && <Link className="panoptes-btn-primary" to={prev}>← Anterior</Link>}
          {next && <Link className="panoptes-btn-primary" to={next}>Siguiente →</Link>}
        </div>
      </div>
    </AppLayout>
  );
};

export default Procedures;

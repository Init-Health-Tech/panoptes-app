import { Form, Link, useLoaderData, useSearchParams } from 'react-router';

import type { PaginatedSupplyKitList } from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';
import { SUPPLY_KIT_STATUS_LABELS } from '@/js/types/medical';
import { makeLink } from '@/js/utils';

type SupplyKitsLoaderData = PaginatedSupplyKitList & {
  filters: { status: string };
};

const SupplyKits = () => {
  const data = useLoaderData<SupplyKitsLoaderData>();
  const [searchParams] = useSearchParams();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);

  return (
    <AppLayout
      subtitle="Armado y rastreo de maletas con tags RFID"
      title="Maletas médicas"
    >
      <Form className="panoptes-card mb-6 flex flex-wrap items-end gap-4 p-4" method="get">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">
            Estado
          </label>
          <select className="panoptes-input" defaultValue={data.filters.status} name="status">
            <option value="">Todos</option>
            {Object.entries(SUPPLY_KIT_STATUS_LABELS).map(([value, label]) => (
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.results?.length ? (
          data.results.map((kit) => (
            <article key={kit.id} className="panoptes-card p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-on-surface-variant">{kit.code}</p>
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-on-surface">
                    {kit.name}
                  </h3>
                </div>
                <KitStatusBadge status={kit.status ?? 'armando'} />
              </div>

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">Hospital destino</dt>
                  <dd>{kit.destination_hospital || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">Tags RFID</dt>
                  <dd className="font-semibold text-primary">{kit.tag_count ?? 0}</dd>
                </div>
              </dl>

              {kit.tag_codes && kit.tag_codes.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1">
                  {kit.tag_codes.map((code) => (
                    <span
                      key={code}
                      className="rounded-md bg-surface-container px-2 py-0.5 font-mono text-xs text-on-surface-variant"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 border-t border-outline-variant/20 pt-3">
                <span className="material-symbols-outlined text-primary status-pulse text-base">
                  sensors
                </span>
                <span className="text-xs text-on-surface-variant">
                  {kit.status === 'en_transito' ? 'Rastreo activo' : 'Listo para escaneo'}
                </span>
              </div>
            </article>
          ))
        ) : (
          <div className="panoptes-card col-span-full p-12 text-center text-on-surface-variant">
            No hay maletas registradas. Crea una desde el admin o la API.
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} maletas en total</span>
        <div className="flex gap-2">
          {prev ? (
            <Link className="panoptes-btn-primary" to={prev}>
              ← Anterior
            </Link>
          ) : (
            <span className="panoptes-btn-primary pointer-events-none opacity-40">← Anterior</span>
          )}
          {next ? (
            <Link className="panoptes-btn-primary" to={next}>
              Siguiente →
            </Link>
          ) : (
            <span className="panoptes-btn-primary pointer-events-none opacity-40">Siguiente →</span>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default SupplyKits;

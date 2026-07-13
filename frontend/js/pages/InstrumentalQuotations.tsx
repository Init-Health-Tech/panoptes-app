import { Form, Link, useLoaderData, useRevalidator, useSearchParams } from 'react-router';

import {
  instrumentProcedureRequestsAcceptQuotationCreate,
  type InstrumentQuotation,
  type PaginatedInstrumentQuotationList,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';
import { makeLink } from '@/js/utils';

const QUOTE_LABELS: Record<string, string> = {
  draft: 'Borrador',
  pending_doctor: 'Pendiente doctor',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
};

const PRICE_SOURCE_LABELS: Record<string, string> = {
  doctor_hospital: 'Contrato doctor + hospital',
  doctor: 'Contrato por doctor',
  hospital: 'Contrato por hospital',
  catalog: 'Precio de catálogo',
  default: 'Precio base',
};

type LoaderData = PaginatedInstrumentQuotationList & {
  filters: { status: string };
};

const InstrumentalQuotations = () => {
  const data = useLoaderData<LoaderData>();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const refresh = () => revalidator.revalidate();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);

  const handleAccept = async (quote: InstrumentQuotation) => {
    if (!quote.request) return;
    await instrumentProcedureRequestsAcceptQuotationCreate({
      path: { id: quote.request },
      throwOnError: true,
    });
    refresh();
  };

  return (
    <AppLayout subtitle="Cotizaciones con precios según contrato de doctor y/o hospital" title="Cotizaciones">
      <Form className="panoptes-card mb-6 flex flex-wrap items-end gap-4 p-4" method="get">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">Estado</label>
          <select className="panoptes-input" defaultValue={data.filters.status} name="status">
            <option value="">Todos</option>
            {Object.entries(QUOTE_LABELS).map(([value, label]) => (
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

      <div className="space-y-4">
        {data.results?.length ? (
          data.results.map((quote) => (
            <article key={quote.id} className="panoptes-card p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-on-surface-variant">COT-{quote.id}</p>
                  <h3 className="text-lg font-semibold">{quote.procedure_type}</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {quote.doctor_name || 'Sin doctor'} · {quote.hospital_name || 'Sin hospital'}
                  </p>
                  {quote.applied_contract_name && (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Contrato: {quote.applied_contract_name}
                    </p>
                  )}
                  <p className="mt-2 text-2xl font-bold text-primary">
                    ${Number(quote.subtotal).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <KitStatusBadge labels={QUOTE_LABELS} status={quote.status ?? 'draft'} />
              </div>

              <ul className="mb-4 space-y-2 text-sm">
                {quote.lines?.map((line) => (
                  <li key={line.id} className="flex justify-between gap-3 border-b border-outline-variant/40 py-1">
                    <span>
                      {line.catalog_sku} — {line.catalog_name} × {line.quantity}
                      {line.requires_sterilization ? ' · Esterilizar' : ''}
                      {line.price_source && (
                        <span className="mt-0.5 block text-xs text-on-surface-variant">
                          {PRICE_SOURCE_LABELS[line.price_source] ?? line.price_source}
                          {line.applied_contract_name ? ` · ${line.applied_contract_name}` : ''}
                          {' · '}${Number(line.unit_price).toFixed(2)} c/u
                        </span>
                      )}
                    </span>
                    <span className="font-mono tabular-nums">${Number(line.line_total).toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              {quote.status === 'pending_doctor' && (
                <button className="panoptes-btn-primary" onClick={() => handleAccept(quote)} type="button">
                  Aceptar cotización (doctor)
                </button>
              )}
              {quote.status === 'accepted' && (
                <Link className="panoptes-btn-primary inline-flex" to="/instrumental-fulfillment">
                  Ir a asignación
                </Link>
              )}
            </article>
          ))
        ) : (
          <div className="panoptes-card p-12 text-center text-on-surface-variant">
            No hay cotizaciones con este filtro.
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} cotizaciones</span>
        <div className="flex gap-2">
          {prev && <Link className="panoptes-btn-primary" to={prev}>← Anterior</Link>}
          {next && <Link className="panoptes-btn-primary" to={next}>Siguiente →</Link>}
        </div>
      </div>
    </AppLayout>
  );
};

export default InstrumentalQuotations;

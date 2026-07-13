import { Link, useLoaderData, useNavigate, useRevalidator, useSearchParams } from 'react-router';
import { useEffect, useMemo, useState } from 'react';

import {
  instrumentProcedureRequestsAcceptQuotationCreate,
  instrumentProcedureRequestsCreateQuotationCreate,
  instrumentProcedureRequestsPlanFulfillmentCreate,
  instrumentProcedureRequestsSubmitCreate,
  type FulfillmentPlan,
  type HospitalSite,
  type InstrumentProcedureRequest,
  type MaterialDispatch,
  type PaginatedInstrumentProcedureRequestList,
  type Technician,
  type TransportVehicle,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { ActionModal } from '@/js/components/ui/ActionModal';
import { FormField } from '@/js/components/ui/FormField';
import { Input } from '@/js/components/ui/Input';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';
import { MaterialMatchSummary, buildMatchRows } from '@/js/components/ui/MaterialMatchSummary';
import { ProcessStepper } from '@/js/components/ui/ProcessStepper';
import { RfidScanHint } from '@/js/components/ui/RfidScanHint';
import { Select } from '@/js/components/ui/Select';
import {
  INSTRUMENTAL_STEP_ROLES,
  instrumentalFlowSteps,
  roleCanActOnStep,
} from '@/js/config/processSteps';
import { useOptionalModules } from '@/js/context/ModulesContext';
import { isFinalizedRequestStatus, partitionByFinalized } from '@/js/utils/workQueue';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Solicitada',
  quotation: 'En cotización',
  quotation_accepted: 'Cotización aceptada',
  fulfillment: 'Listo para carga',
  in_field: 'En campo',
  returning: 'En retorno',
  validated: 'Validado en almacén',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const DISPATCH_LABELS: Record<string, string> = {
  assigned: 'Asignado',
  sterilizing: 'Esterilizando',
  loaded: 'Cargado',
  in_transit: 'En tránsito',
  at_hospital: 'En hospital',
  returning: 'Retornando',
  returned: 'Retornado',
  validated: 'Validado',
};

type LoaderData = PaginatedInstrumentProcedureRequestList & {
  plans: FulfillmentPlan[];
  vehicles: TransportVehicle[];
  technicians: Technician[];
  hospitals: HospitalSite[];
  filters: { status: string; search: string };
};

function FlowCard({
  req,
  plan,
  role,
  finalized = false,
  onOpenPlan,
  onDone,
}: {
  req: InstrumentProcedureRequest;
  plan?: FulfillmentPlan;
  role: string;
  finalized?: boolean;
  onOpenPlan: () => void;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = req.status ?? 'draft';
  const steps = instrumentalFlowSteps(status, role);
  const dispatches: MaterialDispatch[] = plan?.dispatches ?? [];
  const matchRows = buildMatchRows(req, dispatches);
  const loadHref = `/instrumental/${req.id}/load`;
  const eventHref = (type: string) => `/instrumental/${req.id}/event?type=${type}`;

  const run = async (action: () => Promise<unknown>) => {
    await action();
    onDone();
  };

  const actions = (
    <div className="space-y-2">
      {status === 'draft' && roleCanActOnStep(role, 'request', INSTRUMENTAL_STEP_ROLES) && (
        <button
          className="panoptes-btn-primary w-full text-sm lg:w-auto"
          onClick={() =>
            run(() => instrumentProcedureRequestsSubmitCreate({ path: { id: req.id }, throwOnError: true }))
          }
          type="button"
        >
          Enviar solicitud
        </button>
      )}
      {status === 'submitted' && roleCanActOnStep(role, 'quote', INSTRUMENTAL_STEP_ROLES) && (
        <button
          className="panoptes-btn-primary w-full text-sm lg:w-auto"
          onClick={() =>
            run(() =>
              instrumentProcedureRequestsCreateQuotationCreate({ path: { id: req.id }, throwOnError: true }),
            )
          }
          type="button"
        >
          Generar cotización
        </button>
      )}
      {status === 'quotation' && req.quotation_status === 'pending_doctor' && (
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-wrap">
          {roleCanActOnStep(role, 'accept', INSTRUMENTAL_STEP_ROLES) && (
            <button
              className="panoptes-btn-primary text-sm"
              onClick={() =>
                run(() =>
                  instrumentProcedureRequestsAcceptQuotationCreate({
                    path: { id: req.id },
                    throwOnError: true,
                  }),
                )
              }
              type="button"
            >
              Aceptar cotización
            </button>
          )}
          <Link className="panoptes-btn-secondary text-center text-sm" to="/instrumental-quotations">
            Ver cotización
          </Link>
        </div>
      )}
      {status === 'quotation_accepted' && roleCanActOnStep(role, 'fulfill', INSTRUMENTAL_STEP_ROLES) && (
        <button className="panoptes-btn-primary w-full text-sm lg:w-auto" onClick={onOpenPlan} type="button">
          Planificar despacho
        </button>
      )}
      {status === 'fulfillment' && roleCanActOnStep(role, 'load', INSTRUMENTAL_STEP_ROLES) && (
        <Link
          className="panoptes-btn-primary inline-flex w-full items-center justify-center gap-2 text-sm lg:w-auto"
          to={loadHref}
        >
          <span className="material-symbols-outlined text-base">inventory_2</span>
          Cargar material
        </Link>
      )}
      {status === 'in_field' && roleCanActOnStep(role, 'hospital', INSTRUMENTAL_STEP_ROLES) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link className="panoptes-btn-primary text-center text-sm" to={eventHref('hospital_arrival')}>
            Llegada hospital
          </Link>
          <Link className="panoptes-btn-secondary text-center text-sm" to={eventHref('hospital_departure')}>
            Salida hospital
          </Link>
          <Link className="panoptes-btn-secondary text-center text-sm" to={loadHref}>
            Ajustar carga
          </Link>
        </div>
      )}
      {status === 'returning' && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {roleCanActOnStep(role, 'warehouse', INSTRUMENTAL_STEP_ROLES) && (
            <Link className="panoptes-btn-primary text-center text-sm" to={eventHref('return_arrival')}>
              Llegada almacén
            </Link>
          )}
          {roleCanActOnStep(role, 'warehouse', INSTRUMENTAL_STEP_ROLES) && (
            <Link className="panoptes-btn-secondary text-center text-sm" to={eventHref('crcao_validation')}>
              Validación
            </Link>
          )}
        </div>
      )}
    </div>
  );

  const details = (
    <>
      {(status === 'fulfillment' || status === 'in_field' || status === 'returning') && matchRows.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Match vs solicitado
          </p>
          <MaterialMatchSummary rows={matchRows} />
        </div>
      )}
      {plan && (
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-on-surface-variant">Camioneta</dt>
            <dd className="font-medium">{plan.vehicle_code || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">Técnico</dt>
            <dd className="font-medium">{plan.technician_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">Materiales</dt>
            <dd className="font-semibold text-primary">{dispatches.length}</dd>
          </div>
        </dl>
      )}
      {dispatches.length > 0 && (
        <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {dispatches.map((d) => (
            <li
              key={d.id}
              className="flex items-start justify-between gap-2 rounded-md bg-surface-container px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs text-on-surface-variant">
                  {d.rfid_code || d.tracking_identifier || d.sku || d.catalog_sku}
                </p>
                <p className="truncate font-medium text-on-surface">{d.catalog_name || 'Material'}</p>
              </div>
              <span className="shrink-0 text-xs text-on-surface-variant">
                {DISPATCH_LABELS[d.status ?? ''] ?? d.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <article
      className={`panoptes-card-interactive ${finalized ? 'opacity-80' : ''} ${
        /* Mobile card */ 'flex flex-col p-4 sm:p-5 '
      }${/* Desktop row */ 'lg:p-0'}`}
    >
      {/* —— Desktop: steps then buttons underneath —— */}
      <div className="hidden lg:block lg:px-4 lg:py-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] font-semibold text-on-surface-variant">REQ-{req.id}</p>
              <KitStatusBadge labels={STATUS_LABELS} status={status} />
            </div>
            <h3 className="mt-0.5 truncate font-[family-name:var(--font-display)] text-sm font-semibold text-on-surface">
              {req.procedure_type}
            </h3>
            <p className="truncate text-xs text-on-surface-variant">
              {req.doctor_name}
              {req.destination_hospital_name ? ` · ${req.destination_hospital_name}` : ''}
            </p>
          </div>
          <button
            aria-expanded={expanded}
            aria-label={expanded ? 'Ocultar detalle' : 'Ver detalle'}
            className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
            onClick={() => setExpanded((v) => !v)}
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]">
              {expanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        <div className="rounded-md bg-surface-container/50 px-2 py-2">
          <ProcessStepper dense steps={steps} />
        </div>

        {!finalized && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {expanded && (
        <div className="hidden space-y-3 border-t border-outline-variant/30 px-4 py-3 lg:block">{details}</div>
      )}

      {/* —— Mobile / tablet card —— */}
      <div className="lg:hidden">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-on-surface-variant">REQ-{req.id}</p>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-on-surface">
              {req.procedure_type}
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Doctor: <span className="font-medium text-on-surface">{req.doctor_name}</span>
            </p>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              Hospital:{' '}
              <span className="font-medium text-on-surface">{req.destination_hospital_name}</span>
            </p>
          </div>
          <KitStatusBadge labels={STATUS_LABELS} status={status} />
        </div>

        <div className="mb-4 rounded-lg border border-outline-variant/40 bg-surface-container/30 p-3">
          <ProcessStepper steps={steps} />
        </div>

        <div className="mb-4 space-y-3">{details}</div>

        {!finalized && status === 'fulfillment' && (
          <div className="mb-3">
            <RfidScanHint label="Carga en pantalla dedicada (también en celular)." />
          </div>
        )}

        {!finalized && <div className="border-t border-outline-variant/40 pt-4">{actions}</div>}
      </div>
    </article>
  );
}

const InstrumentalFlow = () => {
  const data = useLoaderData<LoaderData>();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modules = useOptionalModules();
  const role = modules?.role ?? 'admin';
  const refresh = () => revalidator.revalidate();

  const [searchText, setSearchText] = useState(data.filters.search);
  const [statusFilter, setStatusFilter] = useState(data.filters.status);

  useEffect(() => {
    setSearchText(data.filters.search);
    setStatusFilter(data.filters.status);
  }, [data.filters.search, data.filters.status]);

  const applyFilters = (search: string, status: string) => {
    const next = new URLSearchParams(searchParams);
    const trimmed = search.trim();
    if (trimmed) next.set('search', trimmed);
    else next.delete('search');
    if (status) next.set('status', status);
    else next.delete('status');
    next.delete('offset');
    const qs = next.toString();
    if (qs !== searchParams.toString()) {
      navigate(qs ? `/instrumental?${qs}` : '/instrumental', { replace: true });
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      applyFilters(searchText, statusFilter);
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const onStatusChange = (value: string) => {
    setStatusFilter(value);
    applyFilters(searchText, value);
  };

  const plansByRequest = useMemo(() => {
    const map = new Map<number, FulfillmentPlan>();
    for (const plan of data.plans ?? []) {
      map.set(plan.request, plan);
    }
    return map;
  }, [data.plans]);

  const { active: activeRequests, finalized: finalizedRequests } = useMemo(
    () =>
      partitionByFinalized(
        data.results ?? [],
        (req) => req.status,
        isFinalizedRequestStatus,
      ),
    [data.results],
  );

  const [planReq, setPlanReq] = useState<InstrumentProcedureRequest | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [planError, setPlanError] = useState('');
  const [busy, setBusy] = useState(false);

  const activeTechnicians = (data.technicians ?? []).filter((t) => t.is_active !== false);

  const closePlan = () => {
    setPlanReq(null);
    setVehicleId('');
    setTechnicianId('');
    setPlanError('');
    setBusy(false);
  };

  const handlePlan = async () => {
    if (!planReq) return;
    setBusy(true);
    setPlanError('');
    try {
      await instrumentProcedureRequestsPlanFulfillmentCreate({
        path: { id: planReq.id },
        body: {
          vehicle: Number(vehicleId),
          lead_technician: Number(technicianId),
        },
        throwOnError: true,
      });
      closePlan();
      refresh();
    } catch {
      setPlanError('No se pudo crear el plan. Revisa camioneta y técnico.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout
      dense
      subtitle="Solicitud → cotización → carga → hospital → almacén"
      title="Control de instrumental"
      tourId="instrumental"
    >
      <div
        className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:items-center"
        data-tour="flow-actions"
      >
        <Link
          className="panoptes-btn-primary w-full text-center text-sm sm:w-auto"
          to="/instrumental-requests"
        >
          Nueva solicitud
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link className="panoptes-btn-secondary flex-1 text-center text-sm sm:flex-none" to="/supply-kits">
            Cargas RFID
          </Link>
          <Link
            className="panoptes-btn-secondary flex-1 text-center text-sm sm:flex-none"
            to="/instrumental-contracts"
          >
            Contratos
          </Link>
          <Link className="panoptes-btn-secondary flex-1 text-center text-sm sm:flex-none" to="/procedures">
            Procedimientos
          </Link>
          <Link className="panoptes-btn-secondary flex-1 text-center text-sm sm:flex-none" to="/inventory">
            Inventario
          </Link>
        </div>
      </div>

      <div className="panoptes-toolbar mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end sm:gap-4">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant" htmlFor="flow-search">
            Buscar procedimiento
          </label>
          <Input
            id="flow-search"
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Tipo, doctor, hospital, ID, notas…"
            type="search"
            value={searchText}
          />
        </div>
        <div className="min-w-0 sm:min-w-[180px]">
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant" htmlFor="flow-status">
            Estado
          </label>
          <select
            className="panoptes-input"
            id="flow-status"
            onChange={(e) => onStatusChange(e.target.value)}
            value={statusFilter}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          {(searchText.trim() || statusFilter) && (
            <button
              className="panoptes-btn-secondary w-full sm:w-auto"
              onClick={() => {
                setSearchText('');
                setStatusFilter('');
                navigate('/instrumental', { replace: true });
              }}
              type="button"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {!data.results?.length ? (
        <div className="panoptes-card p-10 text-center text-on-surface-variant sm:p-14">
          {data.filters.search || data.filters.status
            ? 'No hay resultados con esos filtros.'
            : 'No hay solicitudes. Crea la primera desde «Nueva solicitud».'}
        </div>
      ) : (
        <div className="space-y-8" data-tour="flow-list">
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-on-surface lg:text-lg">
                En proceso
              </h2>
              <span className="text-xs text-on-surface-variant">{activeRequests.length}</span>
            </div>
            {activeRequests.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:gap-2">
                {activeRequests.map((req) => (
                  <FlowCard
                    key={req.id}
                    onDone={refresh}
                    onOpenPlan={() => {
                      setVehicleId('');
                      setTechnicianId('');
                      setPlanReq(req);
                    }}
                    plan={plansByRequest.get(req.id)}
                    req={req}
                    role={role}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container/40 px-4 py-6 text-center text-sm text-on-surface-variant">
                No hay casos activos. Los finalizados están abajo.
              </p>
            )}
          </section>

          {finalizedRequests.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-on-surface-variant lg:text-lg">
                  Finalizados
                </h2>
                <span className="text-xs text-on-surface-variant">{finalizedRequests.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:gap-2">
                {finalizedRequests.map((req) => (
                  <FlowCard
                    key={req.id}
                    finalized
                    onDone={refresh}
                    onOpenPlan={() => undefined}
                    plan={plansByRequest.get(req.id)}
                    req={req}
                    role={role}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <ActionModal
        onClose={closePlan}
        open={!!planReq}
        subtitle={planReq ? `REQ-${planReq.id} · ${planReq.procedure_type}` : undefined}
        title="Planificar despacho"
      >
        <div className="space-y-4">
          <FormField htmlFor="flow-vehicle" label="Camioneta (RFID)">
            <Select id="flow-vehicle" onChange={(e) => setVehicleId(e.target.value)} required value={vehicleId}>
              <option value="">Seleccionar…</option>
              {data.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} — {v.name}
                  {v.rfid_code ? ` [${v.rfid_code}]` : ''}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField htmlFor="flow-tech" label="Técnico responsable">
            <Select
              id="flow-tech"
              onChange={(e) => setTechnicianId(e.target.value)}
              required
              value={technicianId}
            >
              <option value="">Seleccionar…</option>
              {activeTechnicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </FormField>
          {planError && <p className="text-xs text-error">{planError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="panoptes-btn-primary flex-1"
              disabled={busy || !vehicleId || !technicianId}
              onClick={handlePlan}
              type="button"
            >
              {busy ? 'Guardando…' : 'Crear plan'}
            </button>
            <button className="panoptes-btn-secondary" onClick={closePlan} type="button">
              Volver
            </button>
          </div>
        </div>
      </ActionModal>
    </AppLayout>
  );
};

export default InstrumentalFlow;

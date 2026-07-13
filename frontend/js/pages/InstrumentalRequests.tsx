import { Form, Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  instrumentProcedureRequestsCreate,
  instrumentProcedureRequestsCreateQuotationCreate,
  instrumentProcedureRequestsSubmitCreate,
  type InstrumentCatalogItem,
  type InstrumentProcedureRequest,
  type PaginatedInstrumentProcedureRequestList,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { Select } from '@/js/components/ui/Select';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';
import { makeLink } from '@/js/utils';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Solicitada',
  quotation: 'En cotización',
  quotation_accepted: 'Cotización aceptada',
  fulfillment: 'En asignación',
  in_field: 'En campo',
  returning: 'En retorno',
  validated: 'Validado en almacén',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

type LoaderData = PaginatedInstrumentProcedureRequestList & {
  procedures: { id: number; procedure_type: string }[];
  doctors: { id: number; name: string }[];
  hospitals: { id: number; name: string; is_central?: boolean }[];
  catalog: InstrumentCatalogItem[];
  filters: { status: string };
};

function RequestActions({ req, onDone }: { req: InstrumentProcedureRequest; onDone: () => void }) {
  const run = async (action: () => Promise<unknown>) => {
    await action();
    onDone();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {req.status === 'draft' && (
        <button
          className="panoptes-btn-secondary text-xs"
          onClick={() =>
            run(() =>
              instrumentProcedureRequestsSubmitCreate({ path: { id: req.id }, throwOnError: true }),
            )
          }
          type="button"
        >
          Enviar solicitud
        </button>
      )}
      {req.status === 'submitted' && (
        <button
          className="panoptes-btn-primary text-xs"
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
      {req.quotation_status === 'pending_doctor' && (
        <Link className="panoptes-btn-secondary text-xs" to="/instrumental-quotations">
          Ver cotización
        </Link>
      )}
      {req.status === 'quotation_accepted' && (
        <Link className="panoptes-btn-primary text-xs" to="/instrumental-fulfillment">
          Planificar despacho
        </Link>
      )}
      {req.status === 'fulfillment' && (
        <Link className="panoptes-btn-primary text-xs" to={`/instrumental/${req.id}/load`}>
          Cargar material
        </Link>
      )}
      {req.status === 'in_field' && (
        <Link
          className="panoptes-btn-primary text-xs"
          to={`/instrumental/${req.id}/event?type=hospital_arrival`}
        >
          Checklist llegada hospital
        </Link>
      )}
      {req.status === 'returning' && (
        <Link
          className="panoptes-btn-primary text-xs"
          to={`/instrumental/${req.id}/event?type=return_arrival`}
        >
          Checklist llegada almacén
        </Link>
      )}
    </div>
  );
}

const InstrumentalRequests = () => {
  const data = useLoaderData<LoaderData>();
  const revalidator = useRevalidator();
  const refresh = () => revalidator.revalidate();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);

  const [procedureId, setProcedureId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [catalogId, setCatalogId] = useState('');
  const [hours, setHours] = useState('24');
  const [notes, setNotes] = useState('');

  const handleCreate = async () => {
    await instrumentProcedureRequestsCreate({
      body: {
        procedure: Number(procedureId),
        doctor: Number(doctorId),
        destination_hospital: Number(hospitalId),
        status: 'draft',
        estimated_out_hours: Number(hours),
        notes,
        lines: [{ catalog_item: Number(catalogId), quantity: 1 }],
      },
      throwOnError: true,
    });
    setProcedureId('');
    setDoctorId('');
    setHospitalId('');
    setCatalogId('');
    setNotes('');
    refresh();
  };

  return (
    <AppLayout subtitle="Solicitud de instrumental y equipo para procedimientos" title="Solicitudes instrumental">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Crear solicitud" title="Nueva solicitud">
        <FormField htmlFor="inst-procedure" label="Procedimiento">
          <Select id="inst-procedure" onChange={(e) => setProcedureId(e.target.value)} required value={procedureId}>
            <option value="">Seleccionar…</option>
            {data.procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.procedure_type}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="inst-doctor" label="Doctor solicitante">
          <Select id="inst-doctor" onChange={(e) => setDoctorId(e.target.value)} required value={doctorId}>
            <option value="">Seleccionar…</option>
            {data.doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="inst-hospital" label="Hospital destino">
          <Select id="inst-hospital" onChange={(e) => setHospitalId(e.target.value)} required value={hospitalId}>
            <option value="">Seleccionar…</option>
            {data.hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
                {h.is_central ? ' (almacén central)' : ''}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="inst-catalog" label="Instrumental / equipo">
          <Select id="inst-catalog" onChange={(e) => setCatalogId(e.target.value)} required value={catalogId}>
            <option value="">Seleccionar…</option>
            {data.catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sku} — {c.name}
                {c.rfid_code ? ' [RFID]' : ' [SKU]'}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="inst-hours" label="Horas estimadas fuera">
          <Input id="inst-hours" min={1} onChange={(e) => setHours(e.target.value)} type="number" value={hours} />
        </FormField>
        <FormField htmlFor="inst-notes" label="Notas">
          <Input id="inst-notes" onChange={(e) => setNotes(e.target.value)} value={notes} />
        </FormField>
      </FormPanel>

      <Form className="panoptes-card mb-6 flex flex-wrap items-end gap-4 p-4" method="get">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">Estado</label>
          <select className="panoptes-input" defaultValue={data.filters.status} name="status">
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button className="panoptes-btn-primary" type="submit">
          Filtrar
        </button>
      </Form>

      <div className="space-y-4">
        {data.results?.length ? (
          data.results.map((req) => (
            <article key={req.id} className="panoptes-card p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-on-surface-variant">REQ-INST-{req.id}</p>
                  <h3 className="text-lg font-semibold text-on-surface">{req.procedure_type}</h3>
                  <p className="text-sm text-on-surface-variant">
                    {req.doctor_name} → {req.destination_hospital_name}
                  </p>
                </div>
                <KitStatusBadge labels={STATUS_LABELS} status={req.status ?? 'draft'} />
              </div>
              <RequestActions req={req} onDone={refresh} />
            </article>
          ))
        ) : (
          <div className="panoptes-card p-12 text-center text-on-surface-variant">No hay solicitudes.</div>
        )}
      </div>

      <div className="mt-6 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} solicitudes</span>
        <div className="flex gap-2">
          {prev && <Link className="panoptes-btn-primary" to={prev}>← Anterior</Link>}
          {next && <Link className="panoptes-btn-primary" to={next}>Siguiente →</Link>}
        </div>
      </div>
    </AppLayout>
  );
};

export default InstrumentalRequests;

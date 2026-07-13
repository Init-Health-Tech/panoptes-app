import { useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  instrumentProcedureRequestsPlanFulfillmentCreate,
  type FulfillmentPlan,
  type InstrumentProcedureRequest,
  type MaterialDispatch,
  type Technician,
  type TransportVehicle,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Select } from '@/js/components/ui/Select';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';

const PLAN_LABELS: Record<string, string> = {
  planning: 'Planificando',
  ready: 'Listo',
  dispatched: 'Despachado',
  at_hospital: 'En hospital',
  returning: 'Retornando',
  validated: 'Validado',
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

type LoaderData = {
  plans: FulfillmentPlan[];
  acceptedRequests: InstrumentProcedureRequest[];
  vehicles: TransportVehicle[];
  technicians: Technician[];
  dispatches: MaterialDispatch[];
};

const InstrumentalFulfillment = () => {
  const data = useLoaderData<LoaderData>();
  const revalidator = useRevalidator();
  const refresh = () => revalidator.revalidate();

  const [requestId, setRequestId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [technicianId, setTechnicianId] = useState('');

  const handlePlan = async () => {
    await instrumentProcedureRequestsPlanFulfillmentCreate({
      path: { id: Number(requestId) },
      body: {
        vehicle: Number(vehicleId),
        lead_technician: Number(technicianId),
      },
      throwOnError: true,
    });
    setRequestId('');
    setVehicleId('');
    setTechnicianId('');
    refresh();
  };

  return (
    <AppLayout
      subtitle="Asignación de materiales, técnicos, esterilización y camioneta RFID"
      title="Asignación y despacho"
    >
      <FormPanel onSubmit={handlePlan} onSuccess={refresh} submitLabel="Crear plan" title="Planificar cumplimiento">
        <FormField htmlFor="plan-request" label="Solicitud aceptada">
          <Select id="plan-request" onChange={(e) => setRequestId(e.target.value)} required value={requestId}>
            <option value="">Seleccionar…</option>
            {data.acceptedRequests.map((r) => (
              <option key={r.id} value={r.id}>
                REQ-INST-{r.id} — {r.procedure_type}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="plan-vehicle" label="Camioneta (RFID)">
          <Select id="plan-vehicle" onChange={(e) => setVehicleId(e.target.value)} required value={vehicleId}>
            <option value="">Seleccionar…</option>
            {data.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.name}
                {v.rfid_code ? ` [${v.rfid_code}]` : ''}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="plan-tech" label="Técnico responsable">
          <Select id="plan-tech" onChange={(e) => setTechnicianId(e.target.value)} required value={technicianId}>
            <option value="">Seleccionar…</option>
            {data.technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
      </FormPanel>

      <section className="mb-8">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg font-semibold">Planes activos</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.plans.length ? (
            data.plans.map((plan) => (
              <article key={plan.id} className="panoptes-card p-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold">PLAN-{plan.id}</h3>
                  <KitStatusBadge labels={PLAN_LABELS} status={plan.status ?? 'planning'} />
                </div>
                <p className="text-sm text-on-surface-variant">
                  {plan.procedure_type} · {plan.vehicle_code} · {plan.technician_name}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {plan.dispatches?.map((d) => (
                    <li key={d.id} className="flex justify-between">
                      <span className="font-mono text-xs">{d.tracking_identifier}</span>
                      <KitStatusBadge labels={DISPATCH_LABELS} status={d.status ?? 'assigned'} />
                    </li>
                  ))}
                </ul>
              </article>
            ))
          ) : (
            <p className="text-on-surface-variant">Sin planes todavía.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg font-semibold">Materiales en circulación</h2>
        <div className="panoptes-card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="panoptes-table-header">Identificador</th>
                <th className="panoptes-table-header">Ítem</th>
                <th className="panoptes-table-header">Técnico</th>
                <th className="panoptes-table-header">Esterilización</th>
                <th className="panoptes-table-header">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.dispatches.map((d) => (
                <tr key={d.id} className="panoptes-table-row">
                  <td className="px-4 py-3 font-mono text-xs">{d.tracking_identifier}</td>
                  <td className="px-4 py-3">{d.catalog_name}</td>
                  <td className="px-4 py-3">{d.technician_name}</td>
                  <td className="px-4 py-3">{d.requires_sterilization ? d.sterilization_status : '—'}</td>
                  <td className="px-4 py-3">
                    <KitStatusBadge labels={DISPATCH_LABELS} status={d.status ?? 'assigned'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
};

export default InstrumentalFulfillment;

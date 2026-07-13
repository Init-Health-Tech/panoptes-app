import { Form, Link, useLoaderData, useRevalidator, useSearchParams } from 'react-router';
import { useState } from 'react';

import {
  proceduresCreate,
  proceduresPartialUpdate,
  type Doctor,
  type PaginatedProcedureList,
  type Procedure,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { Select } from '@/js/components/ui/Select';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';
import { PROCEDURE_STATUS_LABELS } from '@/js/types/medical';
import { makeLink } from '@/js/utils';

type ProceduresLoaderData = PaginatedProcedureList & {
  filters: { status: string };
  doctors: Doctor[];
};

function ProcedureRow({
  procedure,
  doctors,
  onSaved,
}: {
  procedure: Procedure;
  doctors: Doctor[];
  onSaved: () => void;
}) {
  const [procedureType, setProcedureType] = useState(procedure.procedure_type);
  const [hospital, setHospital] = useState(procedure.destination_hospital);
  const [scheduledDate, setScheduledDate] = useState(procedure.scheduled_date);
  const [doctorId, setDoctorId] = useState(procedure.doctor ? String(procedure.doctor) : '');
  const [status, setStatus] = useState(procedure.status ?? 'scheduled');

  const handleUpdate = async () => {
    await proceduresPartialUpdate({
      path: { id: procedure.id },
      body: {
        procedure_type: procedureType,
        destination_hospital: hospital,
        scheduled_date: scheduledDate,
        doctor: doctorId ? Number(doctorId) : null,
        status,
      },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <tr className="panoptes-table-row">
      <td className="px-4 py-3 font-medium">{procedure.procedure_type}</td>
      <td className="px-4 py-3">{procedure.doctor_name || '—'}</td>
      <td className="px-4 py-3">{procedure.destination_hospital}</td>
      <td className="px-4 py-3 text-on-surface-variant">{procedure.scheduled_date}</td>
      <td className="px-4 py-3">
        <KitStatusBadge labels={PROCEDURE_STATUS_LABELS} status={procedure.status ?? 'scheduled'} />
      </td>
      <td className="px-4 py-3">
        <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title="Editar procedimiento">
          <FormField htmlFor={`proc-type-${procedure.id}`} label="Tipo">
            <Input
              id={`proc-type-${procedure.id}`}
              onChange={(e) => setProcedureType(e.target.value)}
              required
              value={procedureType}
            />
          </FormField>
          <FormField htmlFor={`proc-doctor-${procedure.id}`} label="Doctor">
            <Select
              id={`proc-doctor-${procedure.id}`}
              onChange={(e) => setDoctorId(e.target.value)}
              required
              value={doctorId}
            >
              <option value="">Seleccionar doctor…</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                  {doctor.specialty ? ` — ${doctor.specialty}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField htmlFor={`proc-hosp-${procedure.id}`} label="Hospital">
            <Input
              id={`proc-hosp-${procedure.id}`}
              onChange={(e) => setHospital(e.target.value)}
              required
              value={hospital}
            />
          </FormField>
          <FormField htmlFor={`proc-date-${procedure.id}`} label="Fecha">
            <Input
              id={`proc-date-${procedure.id}`}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
              type="date"
              value={scheduledDate}
            />
          </FormField>
          <FormField htmlFor={`proc-status-${procedure.id}`} label="Estado">
            <Select
              id={`proc-status-${procedure.id}`}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              value={status}
            >
              {Object.entries(PROCEDURE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </EditFormPanel>
      </td>
    </tr>
  );
}

const Procedures = () => {
  const data = useLoaderData<ProceduresLoaderData>();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [procedureType, setProcedureType] = useState('');
  const [hospital, setHospital] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [doctorId, setDoctorId] = useState('');

  const refresh = () => revalidator.revalidate();
  const activeDoctors = data.doctors.filter((d) => d.is_active !== false);

  const handleCreate = async () => {
    await proceduresCreate({
      body: {
        procedure_type: procedureType,
        destination_hospital: hospital,
        scheduled_date: scheduledDate,
        doctor: Number(doctorId),
        status: 'scheduled',
      },
      throwOnError: true,
    });
    setProcedureType('');
    setHospital('');
    setScheduledDate('');
    setDoctorId('');
    refresh();
  };

  return (
    <AppLayout subtitle="Procedimientos médicos programados" title="Procedimientos">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Programar" title="Nuevo procedimiento">
        <FormField htmlFor="proc-type" label="Tipo de procedimiento">
          <Input id="proc-type" onChange={(e) => setProcedureType(e.target.value)} required value={procedureType} />
        </FormField>
        <FormField htmlFor="proc-doctor" label="Doctor que ocupará el instrumental">
          <Select
            id="proc-doctor"
            onChange={(e) => setDoctorId(e.target.value)}
            required
            value={doctorId}
          >
            <option value="">Seleccionar doctor…</option>
            {activeDoctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
                {doctor.specialty ? ` — ${doctor.specialty}` : ''}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="proc-hospital" label="Hospital destino">
          <Input id="proc-hospital" onChange={(e) => setHospital(e.target.value)} required value={hospital} />
        </FormField>
        <FormField htmlFor="proc-date" label="Fecha programada">
          <Input id="proc-date" onChange={(e) => setScheduledDate(e.target.value)} required type="date" value={scheduledDate} />
        </FormField>
      </FormPanel>

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
              <th className="panoptes-table-header">Doctor</th>
              <th className="panoptes-table-header">Hospital</th>
              <th className="panoptes-table-header">Fecha</th>
              <th className="panoptes-table-header">Estado</th>
              <th className="panoptes-table-header w-16"></th>
            </tr>
          </thead>
          <tbody>
            {data.results?.length ? (
              data.results.map((procedure) => (
                <ProcedureRow
                  key={procedure.id}
                  doctors={activeDoctors}
                  onSaved={refresh}
                  procedure={procedure}
                />
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={6}>
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

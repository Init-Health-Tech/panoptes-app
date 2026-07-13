import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  doctorsCreate,
  doctorsPartialUpdate,
  type Doctor,
  type PaginatedDoctorList,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { Checkbox } from '@/js/components/ui/Checkbox';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { makeLink } from '@/js/utils';

function DoctorCard({ doctor, onSaved }: { doctor: Doctor; onSaved: () => void }) {
  const [name, setName] = useState(doctor.name);
  const [specialty, setSpecialty] = useState(doctor.specialty ?? '');
  const [hospital, setHospital] = useState(doctor.hospital ?? '');
  const [isActive, setIsActive] = useState(doctor.is_active ?? true);

  const handleUpdate = async () => {
    await doctorsPartialUpdate({
      path: { id: doctor.id },
      body: { name, specialty, hospital, is_active: isActive },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <article className="panoptes-card p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container/50 text-primary">
            <span className="material-symbols-outlined">person</span>
          </div>
          <div>
            <h3 className="font-semibold text-on-surface">{doctor.name}</h3>
            <p className="text-sm text-on-surface-variant">{doctor.specialty || 'Sin especialidad'}</p>
          </div>
        </div>
        <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title="Editar doctor">
          <FormField htmlFor={`doctor-name-${doctor.id}`} label="Nombre">
            <Input
              id={`doctor-name-${doctor.id}`}
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </FormField>
          <FormField htmlFor={`doctor-specialty-${doctor.id}`} label="Especialidad">
            <Input
              id={`doctor-specialty-${doctor.id}`}
              onChange={(e) => setSpecialty(e.target.value)}
              value={specialty}
            />
          </FormField>
          <FormField htmlFor={`doctor-hospital-${doctor.id}`} label="Hospital">
            <Input
              id={`doctor-hospital-${doctor.id}`}
              onChange={(e) => setHospital(e.target.value)}
              value={hospital}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo
          </label>
        </EditFormPanel>
      </div>
      <p className="text-sm text-on-surface-variant">
        <span className="material-symbols-outlined mr-1 align-middle text-base">local_hospital</span>
        {doctor.hospital || 'Sin hospital asignado'}
      </p>
      <span
        className={`mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
          doctor.is_active
            ? 'bg-secondary-container/60 text-primary'
            : 'bg-surface-container-high text-on-surface-variant'
        }`}
      >
        {doctor.is_active ? 'Activo' : 'Inactivo'}
      </span>
    </article>
  );
}

const Doctors = () => {
  const data = useLoaderData<PaginatedDoctorList>();
  const revalidator = useRevalidator();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [hospital, setHospital] = useState('');

  const refresh = () => revalidator.revalidate();

  const handleCreate = async () => {
    await doctorsCreate({
      body: { name, specialty, hospital, is_active: true },
      throwOnError: true,
    });
    setName('');
    setSpecialty('');
    setHospital('');
    refresh();
  };

  return (
    <AppLayout subtitle="Directorio de doctores por hospital y especialidad" title="Doctores">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Registrar doctor" title="Nuevo doctor">
        <FormField htmlFor="doctor-name" label="Nombre">
          <Input id="doctor-name" onChange={(e) => setName(e.target.value)} required value={name} />
        </FormField>
        <FormField htmlFor="doctor-specialty" label="Especialidad">
          <Input id="doctor-specialty" onChange={(e) => setSpecialty(e.target.value)} value={specialty} />
        </FormField>
        <FormField htmlFor="doctor-hospital" label="Hospital">
          <Input id="doctor-hospital" onChange={(e) => setHospital(e.target.value)} value={hospital} />
        </FormField>
      </FormPanel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.results?.length ? (
          data.results.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} onSaved={refresh} />)
        ) : (
          <div className="panoptes-card col-span-full p-12 text-center text-on-surface-variant">
            No hay doctores en el directorio.
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} doctores</span>
        <div className="flex gap-2">
          {prev && <Link className="panoptes-btn-primary" to={prev}>← Anterior</Link>}
          {next && <Link className="panoptes-btn-primary" to={next}>Siguiente →</Link>}
        </div>
      </div>
    </AppLayout>
  );
};

export default Doctors;

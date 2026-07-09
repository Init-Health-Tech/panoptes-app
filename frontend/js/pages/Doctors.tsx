import { Link, useLoaderData } from 'react-router';

import type { PaginatedDoctorList } from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { makeLink } from '@/js/utils';

const Doctors = () => {
  const data = useLoaderData<PaginatedDoctorList>();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);

  return (
    <AppLayout subtitle="Directorio de doctores por hospital y especialidad" title="Doctores">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.results?.length ? (
          data.results.map((doctor) => (
            <article key={doctor.id} className="panoptes-card p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container/50 text-primary">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <div>
                  <h3 className="font-semibold text-on-surface">{doctor.name}</h3>
                  <p className="text-sm text-on-surface-variant">{doctor.specialty || 'Sin especialidad'}</p>
                </div>
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
          ))
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

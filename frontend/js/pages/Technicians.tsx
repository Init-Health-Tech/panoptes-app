import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  techniciansCreate,
  techniciansPartialUpdate,
  type PaginatedTechnicianList,
  type Technician,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { Checkbox } from '@/js/components/ui/Checkbox';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { makeLink } from '@/js/utils';

function TechnicianCard({ tech, onSaved }: { tech: Technician; onSaved: () => void }) {
  const [name, setName] = useState(tech.name);
  const [isActive, setIsActive] = useState(tech.is_active ?? true);

  const handleUpdate = async () => {
    await techniciansPartialUpdate({
      path: { id: tech.id },
      body: { name, is_active: isActive },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <article className="panoptes-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-tertiary-container/30 text-tertiary">
            <span className="material-symbols-outlined">engineering</span>
          </div>
          <div>
            <h3 className="font-semibold">{tech.name}</h3>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                tech.is_active
                  ? 'bg-secondary-container/60 text-primary'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {tech.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
        <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title="Editar técnico">
          <FormField htmlFor={`tech-name-${tech.id}`} label="Nombre">
            <Input
              id={`tech-name-${tech.id}`}
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo
          </label>
        </EditFormPanel>
      </div>
    </article>
  );
}

const Technicians = () => {
  const data = useLoaderData<PaginatedTechnicianList>();
  const revalidator = useRevalidator();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [name, setName] = useState('');

  const refresh = () => revalidator.revalidate();

  const handleCreate = async () => {
    await techniciansCreate({ body: { name, is_active: true }, throwOnError: true });
    setName('');
    refresh();
  };

  return (
    <AppLayout subtitle="Técnicos de campo y almacén" title="Técnicos">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Registrar técnico" title="Nuevo técnico">
        <FormField htmlFor="tech-name" label="Nombre">
          <Input id="tech-name" onChange={(e) => setName(e.target.value)} required value={name} />
        </FormField>
      </FormPanel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.results?.length ? (
          data.results.map((tech) => <TechnicianCard key={tech.id} onSaved={refresh} tech={tech} />)
        ) : (
          <div className="panoptes-card col-span-full p-12 text-center text-on-surface-variant">
            No hay técnicos registrados.
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} técnicos</span>
        <div className="flex gap-2">
          {prev && <Link className="panoptes-btn-primary" to={prev}>← Anterior</Link>}
          {next && <Link className="panoptes-btn-primary" to={next}>Siguiente →</Link>}
        </div>
      </div>
    </AppLayout>
  );
};

export default Technicians;

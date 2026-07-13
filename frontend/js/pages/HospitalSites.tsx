import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  hospitalSitesCreate,
  hospitalSitesPartialUpdate,
  type HospitalSite,
  type PaginatedHospitalSiteList,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { Checkbox } from '@/js/components/ui/Checkbox';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { makeLink } from '@/js/utils';

function SiteCard({ site, onSaved }: { site: HospitalSite; onSaved: () => void }) {
  const [name, setName] = useState(site.name);
  const [code, setCode] = useState(site.code);
  const [city, setCity] = useState(site.city ?? '');
  const [isCentral, setIsCentral] = useState(site.is_central ?? false);
  const [isActive, setIsActive] = useState(site.is_active ?? true);

  const handleUpdate = async () => {
    await hospitalSitesPartialUpdate({
      path: { id: site.id },
      body: { name, code, city, is_central: isCentral, is_active: isActive },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <article className="panoptes-card p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container/50 text-primary">
            <span className="material-symbols-outlined">
              {site.is_central ? 'warehouse' : 'local_hospital'}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-on-surface">{site.name}</h3>
            <p className="font-mono text-sm text-on-surface-variant">{site.code}</p>
          </div>
        </div>
        <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title="Editar sede">
          <FormField htmlFor={`site-name-${site.id}`} label="Nombre">
            <Input
              id={`site-name-${site.id}`}
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </FormField>
          <FormField htmlFor={`site-code-${site.id}`} label="Código">
            <Input
              id={`site-code-${site.id}`}
              onChange={(e) => setCode(e.target.value)}
              required
              value={code}
            />
          </FormField>
          <FormField htmlFor={`site-city-${site.id}`} label="Ciudad">
            <Input id={`site-city-${site.id}`} onChange={(e) => setCity(e.target.value)} value={city} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Checkbox checked={isCentral} onChange={(e) => setIsCentral(e.target.checked)} />
            Almacén central
          </label>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo
          </label>
        </EditFormPanel>
      </div>
      <p className="text-sm text-on-surface-variant">{site.city || 'Sin ciudad'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {site.is_central && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            Central
          </span>
        )}
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
            site.is_active
              ? 'bg-secondary-container/60 text-primary'
              : 'bg-surface-container-high text-on-surface-variant'
          }`}
        >
          {site.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </div>
    </article>
  );
}

const HospitalSites = () => {
  const data = useLoaderData<PaginatedHospitalSiteList>();
  const revalidator = useRevalidator();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [isCentral, setIsCentral] = useState(false);

  const refresh = () => revalidator.revalidate();

  const handleCreate = async () => {
    await hospitalSitesCreate({
      body: { name, code, city, is_central: isCentral, is_active: true },
      throwOnError: true,
    });
    setName('');
    setCode('');
    setCity('');
    setIsCentral(false);
    refresh();
  };

  return (
    <AppLayout subtitle="Almacén central y hospitales destino" title="Sedes / Hospitales">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Registrar sede" title="Nueva sede">
        <FormField htmlFor="site-name" label="Nombre">
          <Input id="site-name" onChange={(e) => setName(e.target.value)} required value={name} />
        </FormField>
        <FormField htmlFor="site-code" label="Código">
          <Input id="site-code" onChange={(e) => setCode(e.target.value)} required value={code} />
        </FormField>
        <FormField htmlFor="site-city" label="Ciudad">
          <Input id="site-city" onChange={(e) => setCity(e.target.value)} value={city} />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Checkbox checked={isCentral} onChange={(e) => setIsCentral(e.target.checked)} />
          Almacén central
        </label>
      </FormPanel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.results?.length ? (
          data.results.map((site) => <SiteCard key={site.id} onSaved={refresh} site={site} />)
        ) : (
          <p className="text-on-surface-variant sm:col-span-2 xl:col-span-3">No hay sedes registradas.</p>
        )}
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} sedes</span>
        <div className="flex gap-2">
          {prev && (
            <Link className="panoptes-btn-primary" to={prev}>
              ← Anterior
            </Link>
          )}
          {next && (
            <Link className="panoptes-btn-primary" to={next}>
              Siguiente →
            </Link>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default HospitalSites;

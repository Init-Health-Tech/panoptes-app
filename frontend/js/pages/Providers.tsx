import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  providersCreate,
  providersPartialUpdate,
  type PaginatedProviderList,
  type Provider,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { makeLink } from '@/js/utils';

function ProviderRow({ provider, onSaved }: { provider: Provider; onSaved: () => void }) {
  const [businessName, setBusinessName] = useState(provider.business_name);
  const [contact, setContact] = useState(provider.contact ?? '');

  const handleUpdate = async () => {
    await providersPartialUpdate({
      path: { id: provider.id },
      body: { business_name: businessName, contact },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <tr className="panoptes-table-row">
      <td className="px-4 py-3 font-medium">{provider.business_name}</td>
      <td className="px-4 py-3 text-on-surface-variant">{provider.contact || '—'}</td>
      <td className="px-4 py-3">
        <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title="Editar proveedor">
          <FormField htmlFor={`provider-name-${provider.id}`} label="Razón social">
            <Input
              id={`provider-name-${provider.id}`}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              value={businessName}
            />
          </FormField>
          <FormField htmlFor={`provider-contact-${provider.id}`} label="Contacto">
            <Input
              id={`provider-contact-${provider.id}`}
              onChange={(e) => setContact(e.target.value)}
              value={contact}
            />
          </FormField>
        </EditFormPanel>
      </td>
    </tr>
  );
}

const Providers = () => {
  const data = useLoaderData<PaginatedProviderList>();
  const revalidator = useRevalidator();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [businessName, setBusinessName] = useState('');
  const [contact, setContact] = useState('');

  const refresh = () => revalidator.revalidate();

  const handleCreate = async () => {
    await providersCreate({ body: { business_name: businessName, contact }, throwOnError: true });
    setBusinessName('');
    setContact('');
    refresh();
  };

  return (
    <AppLayout subtitle="Proveedores y contactos de abastecimiento" title="Proveedores">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Registrar proveedor" title="Nuevo proveedor">
        <FormField htmlFor="provider-name" label="Razón social">
          <Input id="provider-name" onChange={(e) => setBusinessName(e.target.value)} required value={businessName} />
        </FormField>
        <FormField htmlFor="provider-contact" label="Contacto">
          <Input id="provider-contact" onChange={(e) => setContact(e.target.value)} value={contact} />
        </FormField>
      </FormPanel>

      <div className="panoptes-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="panoptes-table-header">Proveedor</th>
              <th className="panoptes-table-header">Contacto</th>
              <th className="panoptes-table-header w-16"></th>
            </tr>
          </thead>
          <tbody>
            {data.results?.length ? (
              data.results.map((provider) => (
                <ProviderRow key={provider.id} onSaved={refresh} provider={provider} />
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={3}>
                  No hay proveedores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} proveedores</span>
        <div className="flex gap-2">
          {prev && <Link className="panoptes-btn-primary" to={prev}>← Anterior</Link>}
          {next && <Link className="panoptes-btn-primary" to={next}>Siguiente →</Link>}
        </div>
      </div>
    </AppLayout>
  );
};

export default Providers;

import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  clientsCreate,
  clientsPartialUpdate,
  type Client,
  type PaginatedClientList,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { makeLink } from '@/js/utils';

function ClientRow({ client, onSaved }: { client: Client; onSaved: () => void }) {
  const [businessName, setBusinessName] = useState(client.business_name);
  const [contact, setContact] = useState(client.contact ?? '');

  const handleUpdate = async () => {
    await clientsPartialUpdate({
      path: { id: client.id },
      body: { business_name: businessName, contact },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <tr className="panoptes-table-row">
      <td className="px-4 py-3 font-medium">{client.business_name}</td>
      <td className="px-4 py-3 text-on-surface-variant">{client.contact || '—'}</td>
      <td className="px-4 py-3">
        <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title="Editar cliente">
          <FormField htmlFor={`client-name-${client.id}`} label="Razón social">
            <Input
              id={`client-name-${client.id}`}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              value={businessName}
            />
          </FormField>
          <FormField htmlFor={`client-contact-${client.id}`} label="Contacto">
            <Input
              id={`client-contact-${client.id}`}
              onChange={(e) => setContact(e.target.value)}
              value={contact}
            />
          </FormField>
        </EditFormPanel>
      </td>
    </tr>
  );
}

const Clients = () => {
  const data = useLoaderData<PaginatedClientList>();
  const revalidator = useRevalidator();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [businessName, setBusinessName] = useState('');
  const [contact, setContact] = useState('');

  const refresh = () => revalidator.revalidate();

  const handleCreate = async () => {
    await clientsCreate({ body: { business_name: businessName, contact }, throwOnError: true });
    setBusinessName('');
    setContact('');
    refresh();
  };

  return (
    <AppLayout subtitle="Clientes y contactos comerciales" title="Clientes">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Registrar cliente" title="Nuevo cliente">
        <FormField htmlFor="client-name" label="Razón social">
          <Input id="client-name" onChange={(e) => setBusinessName(e.target.value)} required value={businessName} />
        </FormField>
        <FormField htmlFor="client-contact" label="Contacto">
          <Input id="client-contact" onChange={(e) => setContact(e.target.value)} value={contact} />
        </FormField>
      </FormPanel>

      <div className="panoptes-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="panoptes-table-header">Cliente</th>
              <th className="panoptes-table-header">Contacto</th>
              <th className="panoptes-table-header w-16"></th>
            </tr>
          </thead>
          <tbody>
            {data.results?.length ? (
              data.results.map((client) => (
                <ClientRow key={client.id} client={client} onSaved={refresh} />
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={3}>
                  No hay clientes registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} clientes</span>
        <div className="flex gap-2">
          {prev && <Link className="panoptes-btn-primary" to={prev}>← Anterior</Link>}
          {next && <Link className="panoptes-btn-primary" to={next}>Siguiente →</Link>}
        </div>
      </div>
    </AppLayout>
  );
};

export default Clients;

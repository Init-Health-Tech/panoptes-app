import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  transportVehiclesCreate,
  transportVehiclesPartialUpdate,
  type PaginatedTransportVehicleList,
  type RfidTag,
  type TransportVehicle,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { Checkbox } from '@/js/components/ui/Checkbox';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { Select } from '@/js/components/ui/Select';
import { makeLink } from '@/js/utils';

type LoaderData = PaginatedTransportVehicleList & {
  rfidTags: RfidTag[];
};

function RfidTagSelect({
  id,
  value,
  onChange,
  tags,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  tags: RfidTag[];
}) {
  return (
    <Select id={id} onChange={(e) => onChange(e.target.value)} value={value}>
      <option value="">Sin tag RFID</option>
      {tags.map((tag) => (
        <option key={tag.id} value={tag.id}>
          {tag.code}
          {tag.item_type ? ` — ${tag.item_type}` : ''}
          {tag.last_location ? ` (${tag.last_location})` : ''}
        </option>
      ))}
    </Select>
  );
}

function VehicleCard({
  vehicle,
  rfidTags,
  onSaved,
}: {
  vehicle: TransportVehicle;
  rfidTags: RfidTag[];
  onSaved: () => void;
}) {
  const [code, setCode] = useState(vehicle.code);
  const [name, setName] = useState(vehicle.name);
  const [plate, setPlate] = useState(vehicle.plate ?? '');
  const [transporterName, setTransporterName] = useState(vehicle.transporter_name ?? '');
  const [rfidTagId, setRfidTagId] = useState(
    vehicle.rfid_tag != null ? String(vehicle.rfid_tag) : '',
  );
  const [isActive, setIsActive] = useState(vehicle.is_active ?? true);

  const handleUpdate = async () => {
    await transportVehiclesPartialUpdate({
      path: { id: vehicle.id },
      body: {
        code,
        name,
        plate,
        transporter_name: transporterName,
        rfid_tag: rfidTagId ? Number(rfidTagId) : null,
        is_active: isActive,
      },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <article className="panoptes-card p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container/50 text-primary">
            <span className="material-symbols-outlined">local_shipping</span>
          </div>
          <div>
            <h3 className="font-semibold text-on-surface">{vehicle.name}</h3>
            <p className="font-mono text-sm text-on-surface-variant">{vehicle.code}</p>
          </div>
        </div>
        <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title="Editar vehículo">
          <FormField htmlFor={`veh-code-${vehicle.id}`} label="Código">
            <Input
              id={`veh-code-${vehicle.id}`}
              onChange={(e) => setCode(e.target.value)}
              required
              value={code}
            />
          </FormField>
          <FormField htmlFor={`veh-name-${vehicle.id}`} label="Nombre">
            <Input
              id={`veh-name-${vehicle.id}`}
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </FormField>
          <FormField htmlFor={`veh-plate-${vehicle.id}`} label="Placas">
            <Input
              id={`veh-plate-${vehicle.id}`}
              onChange={(e) => setPlate(e.target.value)}
              value={plate}
            />
          </FormField>
          <FormField htmlFor={`veh-transporter-${vehicle.id}`} label="Transportista">
            <Input
              id={`veh-transporter-${vehicle.id}`}
              onChange={(e) => setTransporterName(e.target.value)}
              value={transporterName}
            />
          </FormField>
          <FormField htmlFor={`veh-rfid-${vehicle.id}`} label="Tag RFID (registro / carretera)">
            <RfidTagSelect
              id={`veh-rfid-${vehicle.id}`}
              onChange={setRfidTagId}
              tags={rfidTags}
              value={rfidTagId}
            />
            <p className="mt-1 text-xs text-on-surface-variant">
              Tag de registro vehicular o de carretera para identificar la unidad en lecturas RFID.
            </p>
          </FormField>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo
          </label>
        </EditFormPanel>
      </div>
      <p className="text-sm text-on-surface-variant">
        {vehicle.plate || 'Sin placas'}
        {vehicle.transporter_name ? ` · ${vehicle.transporter_name}` : ''}
      </p>
      {vehicle.rfid_code ? (
        <p className="mt-1 flex items-center gap-1 font-mono text-xs text-primary">
          <span className="material-symbols-outlined text-sm">sensors</span>
          RFID: {vehicle.rfid_code}
        </p>
      ) : (
        <p className="mt-1 text-xs text-on-surface-variant">Sin tag RFID vinculado</p>
      )}
      <span
        className={`mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
          vehicle.is_active
            ? 'bg-secondary-container/60 text-primary'
            : 'bg-surface-container-high text-on-surface-variant'
        }`}
      >
        {vehicle.is_active ? 'Activo' : 'Inactivo'}
      </span>
    </article>
  );
}

const TransportVehicles = () => {
  const data = useLoaderData<LoaderData>();
  const revalidator = useRevalidator();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [rfidTagId, setRfidTagId] = useState('');

  const refresh = () => revalidator.revalidate();
  const rfidTags = data.rfidTags ?? [];

  const handleCreate = async () => {
    await transportVehiclesCreate({
      body: {
        code,
        name,
        plate,
        transporter_name: transporterName,
        rfid_tag: rfidTagId ? Number(rfidTagId) : null,
        is_active: true,
      },
      throwOnError: true,
    });
    setCode('');
    setName('');
    setPlate('');
    setTransporterName('');
    setRfidTagId('');
    refresh();
  };

  return (
    <AppLayout
      subtitle="Flota con RFID de registro vehicular o tag de carretera para despachos y cargas"
      title="Vehículos"
    >
      <FormPanel
        onSubmit={handleCreate}
        onSuccess={refresh}
        submitLabel="Registrar vehículo"
        title="Nuevo vehículo"
      >
        <FormField htmlFor="veh-code" label="Código">
          <Input id="veh-code" onChange={(e) => setCode(e.target.value)} required value={code} />
        </FormField>
        <FormField htmlFor="veh-name" label="Nombre">
          <Input id="veh-name" onChange={(e) => setName(e.target.value)} required value={name} />
        </FormField>
        <FormField htmlFor="veh-plate" label="Placas">
          <Input id="veh-plate" onChange={(e) => setPlate(e.target.value)} value={plate} />
        </FormField>
        <FormField htmlFor="veh-transporter" label="Transportista">
          <Input
            id="veh-transporter"
            onChange={(e) => setTransporterName(e.target.value)}
            value={transporterName}
          />
        </FormField>
        <FormField htmlFor="veh-rfid" label="Tag RFID (registro / carretera)">
          <RfidTagSelect id="veh-rfid" onChange={setRfidTagId} tags={rfidTags} value={rfidTagId} />
          <p className="mt-1 text-xs text-on-surface-variant">
            Vincula el EPC del tag vehicular o de carretera. Si aún no existe, regístralo primero en
            Inventario.
          </p>
        </FormField>
      </FormPanel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.results?.length ? (
          data.results.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              onSaved={refresh}
              rfidTags={rfidTags}
              vehicle={vehicle}
            />
          ))
        ) : (
          <p className="text-on-surface-variant sm:col-span-2 xl:col-span-3">
            No hay vehículos registrados.
          </p>
        )}
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} vehículos</span>
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

export default TransportVehicles;

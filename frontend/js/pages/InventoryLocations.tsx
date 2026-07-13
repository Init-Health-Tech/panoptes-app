import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  inventoryLocationsCreate,
  inventoryLocationsPartialUpdate,
  type InventoryLocation,
  type LocationTypeEnum,
  type PaginatedInventoryLocationList,
} from '@/js/api';
import {
  inventoryLocationsImportTemplateDownload,
  inventoryLocationsImportUpload,
} from '@/js/api/bulkImport';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { BulkImportPanel } from '@/js/components/ui/BulkImportPanel';
import { Checkbox } from '@/js/components/ui/Checkbox';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { Select } from '@/js/components/ui/Select';
import { makeLink } from '@/js/utils';

const LOCATION_TYPE_LABELS: Record<LocationTypeEnum, string> = {
  warehouse: 'Almacén',
  zone: 'Zona / anaquel',
  hospital: 'Hospital',
  vehicle: 'Vehículo',
  other: 'Otro',
};

const LOCATION_TYPE_OPTIONS = Object.entries(LOCATION_TYPE_LABELS) as [
  LocationTypeEnum,
  string,
][];

function LocationRow({
  location,
  onSaved,
}: {
  location: InventoryLocation;
  onSaved: () => void;
}) {
  const [name, setName] = useState(location.name);
  const [code, setCode] = useState(location.code);
  const [locationType, setLocationType] = useState<LocationTypeEnum>(
    location.location_type ?? 'warehouse',
  );
  const [isActive, setIsActive] = useState(location.is_active ?? true);

  const handleUpdate = async () => {
    await inventoryLocationsPartialUpdate({
      path: { id: location.id },
      body: { name, code, location_type: locationType, is_active: isActive },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <tr className="panoptes-table-row">
      <td className="px-4 py-3 font-mono font-medium">{location.code}</td>
      <td className="px-4 py-3">{location.name}</td>
      <td className="px-4 py-3 text-on-surface-variant">
        {LOCATION_TYPE_LABELS[location.location_type ?? 'warehouse']}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
            location.is_active
              ? 'bg-secondary-container/60 text-primary'
              : 'bg-surface-container-high text-on-surface-variant'
          }`}
        >
          {location.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-4 py-3">
        <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title="Editar ubicación">
          <FormField htmlFor={`loc-code-${location.id}`} label="Código">
            <Input
              id={`loc-code-${location.id}`}
              onChange={(e) => setCode(e.target.value)}
              required
              value={code}
            />
          </FormField>
          <FormField htmlFor={`loc-name-${location.id}`} label="Nombre">
            <Input
              id={`loc-name-${location.id}`}
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </FormField>
          <FormField htmlFor={`loc-type-${location.id}`} label="Tipo">
            <Select
              id={`loc-type-${location.id}`}
              onChange={(e) => setLocationType(e.target.value as LocationTypeEnum)}
              value={locationType}
            >
              {LOCATION_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo
          </label>
        </EditFormPanel>
      </td>
    </tr>
  );
}

const InventoryLocations = () => {
  const data = useLoaderData<PaginatedInventoryLocationList>();
  const revalidator = useRevalidator();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [locationType, setLocationType] = useState<LocationTypeEnum>('warehouse');

  const refresh = () => revalidator.revalidate();

  const handleCreate = async () => {
    await inventoryLocationsCreate({
      body: { name, code, location_type: locationType, is_active: true },
      throwOnError: true,
    });
    setName('');
    setCode('');
    setLocationType('warehouse');
    refresh();
  };

  return (
    <AppLayout
      subtitle="Almacenes, zonas y hospitales para ubicaciones RFID"
      title="Ubicaciones de inventario"
    >
      <div className="mb-2 flex flex-wrap gap-2">
      <FormPanel
        onSubmit={handleCreate}
        onSuccess={refresh}
        submitLabel="Registrar ubicación"
        title="Nueva ubicación"
      >
        <FormField htmlFor="loc-code" label="Código">
          <Input id="loc-code" onChange={(e) => setCode(e.target.value)} required value={code} />
        </FormField>
        <FormField htmlFor="loc-name" label="Nombre">
          <Input id="loc-name" onChange={(e) => setName(e.target.value)} required value={name} />
        </FormField>
        <FormField htmlFor="loc-type" label="Tipo">
          <Select
            id="loc-type"
            onChange={(e) => setLocationType(e.target.value as LocationTypeEnum)}
            value={locationType}
          >
            {LOCATION_TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
      </FormPanel>
      <BulkImportPanel
        description="Plantilla con code, name y location_type. Códigos duplicados se omiten con aviso por fila."
        onDownloadTemplate={inventoryLocationsImportTemplateDownload}
        onSuccess={refresh}
        onUpload={inventoryLocationsImportUpload}
        title="Carga masiva ubicaciones"
      />
      </div>

      <div className="panoptes-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="panoptes-table-header">Código</th>
              <th className="panoptes-table-header">Nombre</th>
              <th className="panoptes-table-header">Tipo</th>
              <th className="panoptes-table-header">Estado</th>
              <th className="panoptes-table-header w-16"></th>
            </tr>
          </thead>
          <tbody>
            {data.results?.length ? (
              data.results.map((location) => (
                <LocationRow key={location.id} location={location} onSaved={refresh} />
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={5}>
                  No hay ubicaciones en el catálogo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} ubicaciones</span>
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

export default InventoryLocations;

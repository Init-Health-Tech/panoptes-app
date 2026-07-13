import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';

import {
  instrumentPriceContractsCreate,
  type Doctor,
  type HospitalSite,
  type InstrumentCatalogItem,
  type InstrumentPriceContract,
  type PaginatedInstrumentPriceContractList,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { Select } from '@/js/components/ui/Select';

const SCOPE_LABELS: Record<string, string> = {
  doctor_hospital: 'Doctor + hospital',
  doctor: 'Solo doctor',
  hospital: 'Solo hospital',
};

type LoaderData = PaginatedInstrumentPriceContractList & {
  doctors: Doctor[];
  hospitals: HospitalSite[];
  catalog: InstrumentCatalogItem[];
};

type DraftLine = {
  catalog_item: string;
  unit_price: string;
};

const InstrumentalContracts = () => {
  const data = useLoaderData<LoaderData>();
  const revalidator = useRevalidator();
  const refresh = () => revalidator.revalidate();

  const [name, setName] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ catalog_item: '', unit_price: '' }]);

  const hospitals = (data.hospitals ?? []).filter((h) => !h.is_central);
  const doctors = data.doctors ?? [];
  const catalog = data.catalog ?? [];

  const handleCreate = async () => {
    const payloadLines = lines
      .filter((line) => line.catalog_item && line.unit_price)
      .map((line) => ({
        catalog_item: Number(line.catalog_item),
        unit_price: line.unit_price,
      }));

    await instrumentPriceContractsCreate({
      body: {
        name,
        doctor: doctorId ? Number(doctorId) : null,
        hospital: hospitalId ? Number(hospitalId) : null,
        is_active: true,
        notes,
        lines: payloadLines,
      },
      throwOnError: true,
    });
    setName('');
    setDoctorId('');
    setHospitalId('');
    setNotes('');
    setLines([{ catalog_item: '', unit_price: '' }]);
    refresh();
  };

  return (
    <AppLayout
      subtitle="Precios distintos por doctor, hospital o ambos — se aplican al generar cotizaciones"
      title="Contratos"
    >
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Crear contrato" title="Nuevo contrato">
        <FormField htmlFor="contract-name" label="Nombre">
          <Input
            id="contract-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Contrato Dr. García @ ABC"
            required
            value={name}
          />
        </FormField>
        <FormField htmlFor="contract-doctor" label="Doctor (opcional)">
          <Select id="contract-doctor" onChange={(e) => setDoctorId(e.target.value)} value={doctorId}>
            <option value="">Cualquier doctor</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="contract-hospital" label="Hospital (opcional)">
          <Select id="contract-hospital" onChange={(e) => setHospitalId(e.target.value)} value={hospitalId}>
            <option value="">Cualquier hospital</option>
            {hospitals.map((hospital) => (
              <option key={hospital.id} value={hospital.id}>
                {hospital.name}
              </option>
            ))}
          </Select>
        </FormField>
        <p className="text-xs text-on-surface-variant">
          Debes elegir doctor, hospital o ambos. Prioridad al cotizar: doctor+hospital → doctor → hospital →
          precio de catálogo.
        </p>
        <FormField htmlFor="contract-notes" label="Notas">
          <Input id="contract-notes" onChange={(e) => setNotes(e.target.value)} value={notes} />
        </FormField>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase text-on-surface-variant">Líneas de precio</p>
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-2">
              <Select
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...line, catalog_item: e.target.value };
                  setLines(next);
                }}
                value={line.catalog_item}
              >
                <option value="">Producto del catálogo…</option>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.name}
                    {item.default_unit_price != null ? ` (base $${item.default_unit_price})` : ''}
                  </option>
                ))}
              </Select>
              <Input
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...line, unit_price: e.target.value };
                  setLines(next);
                }}
                placeholder="Precio unitario"
                type="number"
                value={line.unit_price}
              />
            </div>
          ))}
          <button
            className="panoptes-btn-secondary text-xs"
            onClick={() => setLines([...lines, { catalog_item: '', unit_price: '' }])}
            type="button"
          >
            + Agregar línea
          </button>
        </div>
      </FormPanel>

      <div className="space-y-4">
        {data.results?.length ? (
          data.results.map((contract: InstrumentPriceContract) => (
            <article key={contract.id} className="panoptes-card p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-on-surface">{contract.name}</h3>
                  <p className="text-sm text-on-surface-variant">
                    {SCOPE_LABELS[contract.scope_label] ?? contract.scope_label}
                    {contract.doctor_name ? ` · ${contract.doctor_name}` : ''}
                    {contract.hospital_name ? ` · ${contract.hospital_name}` : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    contract.is_active
                      ? 'bg-secondary-container/50 text-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {contract.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <ul className="space-y-1.5 text-sm">
                {contract.lines?.map((line) => (
                  <li
                    key={line.id}
                    className="flex justify-between gap-2 border-b border-outline-variant/30 py-1"
                  >
                    <span>
                      {line.catalog_sku} — {line.catalog_name}
                    </span>
                    <span className="font-mono tabular-nums">
                      ${Number(line.unit_price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
              {contract.notes && (
                <p className="mt-3 text-xs text-on-surface-variant">{contract.notes}</p>
              )}
            </article>
          ))
        ) : (
          <div className="panoptes-card p-12 text-center text-on-surface-variant">
            No hay contratos registrados.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default InstrumentalContracts;

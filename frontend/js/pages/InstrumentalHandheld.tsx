import { useLoaderData, useRevalidator, useSearchParams } from 'react-router';
import { useEffect, useState } from 'react';

import { instrumentalHandheldScansCreate, type EventTypeEnum, type HospitalSite } from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { Select } from '@/js/components/ui/Select';

const EVENT_LABELS: Record<EventTypeEnum, string> = {
  load_departure: 'Salida de almacén (carga)',
  hospital_arrival: 'Llegada hospital',
  hospital_departure: 'Salida hospital (retorno)',
  return_arrival: 'Llegada al almacén',
  crcao_validation: 'Validación en almacén',
};

const EVENT_TYPES = Object.keys(EVENT_LABELS) as EventTypeEnum[];

function resolveInitialEvent(raw: string | null): EventTypeEnum {
  if (raw && EVENT_TYPES.includes(raw as EventTypeEnum)) return raw as EventTypeEnum;
  return 'load_departure';
}

type LoaderData = {
  hospitals: HospitalSite[];
};

const InstrumentalHandheld = () => {
  const data = useLoaderData<LoaderData>();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [eventType, setEventType] = useState<EventTypeEnum>(() =>
    resolveInitialEvent(searchParams.get('event')),
  );
  const [hospitalId, setHospitalId] = useState('');
  const [handheldId, setHandheldId] = useState('HH-DEMO-01');
  const [lastResult, setLastResult] = useState<string>('');

  useEffect(() => {
    setEventType(resolveInitialEvent(searchParams.get('event')));
  }, [searchParams]);

  const centralWarehouse = data.hospitals.find((h) => h.is_central);

  const handleScan = async () => {
    const response = await instrumentalHandheldScansCreate({
      body: {
        identifier,
        event_type: eventType,
        hospital: hospitalId ? Number(hospitalId) : centralWarehouse?.id,
        handheld_id: handheldId,
      },
      throwOnError: true,
    });
    const payload = response.data as { dispatch_status?: string; tracking_identifier?: string };
    setLastResult(
      `OK — ${payload.tracking_identifier ?? identifier} → ${payload.dispatch_status ?? 'registrado'}`,
    );
    setIdentifier('');
    revalidator.revalidate();
  };

  return (
    <AppLayout
      subtitle="Demo handheld: escanea RFID (EPC) o SKU ASCII sin lector"
      title="Handheld instrumental"
    >
      <div className="panoptes-card mb-6 border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-semibold text-on-surface">Modo demo dual</p>
        <p className="mt-1 text-on-surface-variant">
          Usa el código ASCII (ej. <code className="font-mono">AVANT0000011</code>), el EPC hex de 24
          caracteres, o el SKU de catálogo (ej. <code className="font-mono">SKU-CLN-MONITOR-01</code>).
          Ambos actualizan inventario y estado del despacho.
        </p>
      </div>

      <FormPanel onSubmit={handleScan} submitLabel="Registrar escaneo" title="Escanear material">
        <FormField htmlFor="hh-id" label="ID Handheld">
          <Input id="hh-id" onChange={(e) => setHandheldId(e.target.value)} value={handheldId} />
        </FormField>
        <FormField htmlFor="hh-identifier" label="RFID (EPC) o ASCII">
          <Input
            id="hh-identifier"
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="AVANT0000011 o AVANT0000001"
            required
            value={identifier}
          />
          <p className="mt-1 text-xs text-on-surface-variant">
            Acepta EPC de 24 hex o su equivalente ASCII de 12 caracteres, además de SKU de catálogo.
          </p>
        </FormField>
        <FormField htmlFor="hh-event" label="Evento">
          <Select
            id="hh-event"
            onChange={(e) => setEventType(e.target.value as EventTypeEnum)}
            value={eventType}
          >
            {EVENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {EVENT_LABELS[value]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="hh-hospital" label="Hospital (opcional)">
          <Select id="hh-hospital" onChange={(e) => setHospitalId(e.target.value)} value={hospitalId}>
            <option value="">Auto (almacén central si aplica)</option>
            {data.hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </FormField>
      </FormPanel>

      {lastResult && (
        <div className="panoptes-card mt-4 border-tertiary/40 bg-tertiary/10 p-4 text-sm font-medium text-on-surface">
          {lastResult}
        </div>
      )}
    </AppLayout>
  );
};

export default InstrumentalHandheld;

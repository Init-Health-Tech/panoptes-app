import { useState, useMemo } from 'react';
import { Form, Link, useLoaderData, useRevalidator, useSearchParams } from 'react-router';

import {
  supplyKitsAddTagsCreate,
  supplyKitsAssignDispatchCreate,
  supplyKitsConfirmHospitalArrivalCreate,
  supplyKitsConfirmWarehouseReturnCreate,
  supplyKitsCreate,
  supplyKitsPartialUpdate,
  supplyKitsUpdateReturnChecklistCreate,
  type PaginatedSupplyKitList,
  type Procedure,
  type ReturnChecklistItem,
  type RfidTag,
  type SupplyKit,
  type Technician,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { CustodyBadge } from '@/js/components/ui/CustodyBadge';
import { DocumentPlaceholderButton } from '@/js/components/ui/DocumentPlaceholderButton';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';
import { ProcessStepper } from '@/js/components/ui/ProcessStepper';
import { RfidScanHint } from '@/js/components/ui/RfidScanHint';
import { Select } from '@/js/components/ui/Select';
import { clinicalLoadSteps } from '@/js/config/processSteps';
import { useOptionalModules } from '@/js/context/ModulesContext';
import { MATERIAL_CATEGORY_EXAMPLES } from '@/js/types/materialExamples';
import { SUPPLY_KIT_STATUS_LABELS } from '@/js/types/medical';
import { isFinalizedKitStatus, partitionByFinalized } from '@/js/utils/workQueue';
import { makeLink } from '@/js/utils';

type KitTag = {
  id: number;
  code: string;
  item_type?: string;
  status?: string;
  last_location?: string;
};

type SupplyKitWithTags = SupplyKit & {
  tags?: KitTag[];
  procedure_type?: string | null;
};

type SupplyKitsLoaderData = PaginatedSupplyKitList & {
  filters: { status: string };
  tags: RfidTag[];
  technicians: Technician[];
  proceduresWithoutKit: Procedure[];
};

function tagProductLabel(tag: Pick<RfidTag, 'code' | 'item_type'> | KitTag) {
  const product = tag.item_type?.trim();
  return product ? `${tag.code} — ${product}` : tag.code;
}

function checklistItems(kit: SupplyKitWithTags): ReturnChecklistItem[] {
  if (Array.isArray(kit.return_checklist) && kit.return_checklist.length > 0) {
    return kit.return_checklist as ReturnChecklistItem[];
  }
  return (kit.tags ?? []).map((tag) => ({
    code: tag.code,
    item_type: tag.item_type ?? '',
    checked: false,
  }));
}

function SupplyKitCard({
  kit,
  tags,
  technicians,
  proceduresWithoutKit,
  role,
  onSaved,
}: {
  kit: SupplyKitWithTags;
  tags: RfidTag[];
  technicians: Technician[];
  proceduresWithoutKit: Procedure[];
  role: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(kit.name);
  const [code, setCode] = useState(kit.code);
  const [destination, setDestination] = useState(kit.destination_hospital ?? '');
  const [status, setStatus] = useState(kit.status ?? 'armando');
  const [procedureId, setProcedureId] = useState(kit.procedure ? String(kit.procedure) : '');
  const [tagId, setTagId] = useState('');
  const [transporter, setTransporter] = useState(kit.transporter_name ?? '');
  const [technicianId, setTechnicianId] = useState(
    kit.assigned_technician ? String(kit.assigned_technician) : '',
  );
  const [checklist, setChecklist] = useState<ReturnChecklistItem[]>(() => checklistItems(kit));

  const kitTags: KitTag[] =
    kit.tags && kit.tags.length > 0
      ? kit.tags
      : (kit.tag_codes ?? []).map((tagCode) => {
          const match = tags.find((t) => t.code === tagCode);
          return {
            id: match?.id ?? 0,
            code: tagCode,
            item_type: match?.item_type ?? '',
            status: match?.status,
            last_location: match?.last_location ?? '',
          };
        });

  const assignedCodes = new Set(kitTags.map((t) => t.code));
  const availableTags = tags.filter(
    (tag) =>
      tag.code &&
      !assignedCodes.has(tag.code) &&
      ((tag.is_available !== false && tag.is_available !== 'false') || tag.custody_type == null),
  );
  // Prefer tags explicitly marked available when custody fields exist
  const loadableTags = availableTags.filter(
    (tag) => tag.is_available !== false && tag.is_available !== 'false',
  );
  const activeTechnicians = technicians.filter((t) => t.is_active !== false);
  const kitStatus = kit.status ?? 'armando';
  const steps = clinicalLoadSteps(kitStatus, role);
  const canDispatch =
    (kitStatus === 'armando' || kitStatus === 'lista') && kitTags.length > 0;
  const canConfirmHospital = kitStatus === 'en_transito';
  const canEditChecklist = kitStatus === 'entregada' || kitStatus === 'retornando';
  const canConfirmWarehouse =
    kitStatus === 'retornando' &&
    checklist.length > 0 &&
    checklist.every((item) => item.checked);

  const procedureOptions = [
    ...(kit.procedure
      ? [
          {
            id: kit.procedure,
            procedure_type: kit.procedure_type || `Procedimiento #${kit.procedure}`,
            destination_hospital: kit.destination_hospital || '',
            doctor_name: kit.procedure_doctor_name,
          },
        ]
      : []),
    ...proceduresWithoutKit,
  ];

  const handleUpdate = async () => {
    await supplyKitsPartialUpdate({
      path: { id: kit.id },
      body: {
        name,
        code,
        destination_hospital: destination,
        status,
        procedure: procedureId ? Number(procedureId) : null,
      },
      throwOnError: true,
    });
    onSaved();
  };

  const handleAddTag = async () => {
    if (!tagId) return;
    await supplyKitsAddTagsCreate({
      path: { id: kit.id },
      body: { tag_ids: [Number(tagId)] },
      throwOnError: true,
    });
    setTagId('');
    onSaved();
  };

  const handleDispatch = async () => {
    await supplyKitsAssignDispatchCreate({
      path: { id: kit.id },
      body: {
        transporter_name: transporter,
        assigned_technician: Number(technicianId),
      },
      throwOnError: true,
    });
    onSaved();
  };

  const handleConfirmHospital = async () => {
    await supplyKitsConfirmHospitalArrivalCreate({
      path: { id: kit.id },
      throwOnError: true,
    });
    onSaved();
  };

  const handleSaveChecklist = async () => {
    await supplyKitsUpdateReturnChecklistCreate({
      path: { id: kit.id },
      body: { items: checklist },
      throwOnError: true,
    });
    onSaved();
  };

  const handleConfirmWarehouse = async () => {
    await supplyKitsConfirmWarehouseReturnCreate({
      path: { id: kit.id },
      throwOnError: true,
    });
    onSaved();
  };

  const selectedTag = loadableTags.find((t) => String(t.id) === tagId);

  return (
    <article
      className={`panoptes-card-interactive flex flex-col p-4 sm:p-5 lg:p-6 ${
        kitStatus === 'devuelta' || kitStatus === 'usada' ? 'opacity-75' : ''
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3 lg:mb-4">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-on-surface-variant">{kit.code}</p>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-on-surface lg:text-xl">
            {kit.name}
          </h3>
          {kit.procedure_type && (
            <p className="mt-1 text-sm text-on-surface-variant">
              Procedimiento: <span className="font-medium text-on-surface">{kit.procedure_type}</span>
            </p>
          )}
          {kit.procedure_doctor_name && (
            <p className="mt-0.5 text-sm text-on-surface-variant">
              Doctor: <span className="font-medium text-on-surface">{kit.procedure_doctor_name}</span>
            </p>
          )}
        </div>
        <KitStatusBadge status={kitStatus} />
      </div>

      <div className="mb-4 rounded-lg border border-outline-variant/40 bg-surface-container/30 p-3 lg:p-4">
        <ProcessStepper steps={steps} />
      </div>

      <dl className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-on-surface-variant">Hospital destino</dt>
          <dd className="text-right">{kit.destination_hospital || '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="flex items-center gap-1 text-on-surface-variant">
            <span aria-hidden className="material-symbols-outlined text-sm">
              sensors
            </span>
            Tags RFID
          </dt>
          <dd className="font-semibold text-primary">{kit.tag_count ?? kitTags.length}</dd>
        </div>
        {kit.transporter_name && (
          <div className="flex justify-between gap-2">
            <dt className="text-on-surface-variant">Transportador</dt>
            <dd className="text-right">{kit.transporter_name}</dd>
          </div>
        )}
        {kit.assigned_technician_name && (
          <div className="flex justify-between gap-2">
            <dt className="text-on-surface-variant">Técnico</dt>
            <dd className="text-right">{kit.assigned_technician_name}</dd>
          </div>
        )}
      </dl>

      {kitTags.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            <span aria-hidden className="material-symbols-outlined text-sm text-primary">
              sensors
            </span>
            Contenido RFID
          </p>
          <ul className="space-y-1.5">
            {kitTags.map((tag) => (
              <li
                key={tag.code}
                className="flex items-start justify-between gap-2 rounded-md bg-surface-container px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span aria-hidden className="material-symbols-outlined mt-0.5 text-base text-on-surface-variant">
                    contactless
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-on-surface-variant">{tag.code}</p>
                    <p className="font-medium text-on-surface">
                      {tag.item_type?.trim() || 'Producto no definido'}
                    </p>
                  </div>
                </div>
                {tag.last_location && (
                  <span className="shrink-0 text-xs text-on-surface-variant">{tag.last_location}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto space-y-4 border-t border-outline-variant/40 pt-4">
        <EditFormPanel expanded onSubmit={handleUpdate} onSuccess={onSaved} title="Editar instrumental">
          <FormField htmlFor={`kit-code-${kit.id}`} label="Código">
            <Input id={`kit-code-${kit.id}`} onChange={(e) => setCode(e.target.value)} required value={code} />
          </FormField>
          <FormField htmlFor={`kit-name-${kit.id}`} label="Nombre">
            <Input id={`kit-name-${kit.id}`} onChange={(e) => setName(e.target.value)} required value={name} />
          </FormField>
          <FormField htmlFor={`kit-dest-${kit.id}`} label="Hospital destino">
            <Input
              id={`kit-dest-${kit.id}`}
              onChange={(e) => setDestination(e.target.value)}
              value={destination}
            />
          </FormField>
          <FormField htmlFor={`kit-status-${kit.id}`} label="Estado">
            <Select
              id={`kit-status-${kit.id}`}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              value={status}
            >
              {Object.entries(SUPPLY_KIT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField htmlFor={`kit-proc-${kit.id}`} label="Procedimiento">
            <Select
              id={`kit-proc-${kit.id}`}
              onChange={(e) => {
                const nextId = e.target.value;
                setProcedureId(nextId);
                const proc = procedureOptions.find((p) => String(p.id) === nextId);
                if (proc?.destination_hospital) {
                  setDestination(proc.destination_hospital);
                }
              }}
              value={procedureId}
            >
              <option value="">Sin procedimiento</option>
              {procedureOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.procedure_type}
                  {'doctor_name' in p && p.doctor_name ? ` — ${p.doctor_name}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
        </EditFormPanel>

        {loadableTags.length > 0 && (kitStatus === 'armando' || kitStatus === 'lista') && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
              <span aria-hidden className="material-symbols-outlined text-base text-primary">
                sensors
              </span>
              Cargar productos RFID
            </p>
            <p className="text-xs text-on-surface-variant">
              Solo tags libres (sin custodia en otra carga o despacho).
            </p>
            <FormField htmlFor={`kit-tag-${kit.id}`} label="Asignar tag RFID (producto)">
              <Select id={`kit-tag-${kit.id}`} onChange={(e) => setTagId(e.target.value)} value={tagId}>
                <option value="">Seleccionar tag / producto…</option>
                {loadableTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tagProductLabel(tag)}
                  </option>
                ))}
              </Select>
            </FormField>
            {selectedTag && (
              <p className="rounded-md bg-primary/5 px-3 py-2 text-xs text-on-surface-variant">
                Producto:{' '}
                <span className="font-semibold text-on-surface">
                  {selectedTag.item_type?.trim() || 'Sin tipo de producto'}
                </span>
                {selectedTag.last_location ? ` · Ubicación: ${selectedTag.last_location}` : ''}{' '}
                <CustodyBadge
                  custodyLabel={selectedTag.custody_label}
                  custodyType={selectedTag.custody_type}
                  isAvailable={selectedTag.is_available}
                />
              </p>
            )}
            <button className="panoptes-btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto" disabled={!tagId} onClick={handleAddTag} type="button">
              <span aria-hidden className="material-symbols-outlined text-base">
                contactless
              </span>
              Asignar tag
            </button>
            <RfidScanHint label="También se pueden cargar productos vía lectura RFID (próximamente)." />
          </div>
        )}

        {canDispatch && (
          <section className="space-y-3 rounded-md border border-outline-variant/40 bg-surface-container/40 p-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
              <span aria-hidden className="material-symbols-outlined text-base text-primary">
                local_shipping
              </span>
              Salida de material
            </h4>
            <p className="text-xs text-on-surface-variant">
              Asigna transportador y técnico antes de mandar al hospital.
            </p>
            <RfidScanHint label="Cargar / verificar productos de salida vía RFID (próximamente)." />
            <FormField htmlFor={`kit-transporter-${kit.id}`} label="Transportador">
              <Input
                id={`kit-transporter-${kit.id}`}
                onChange={(e) => setTransporter(e.target.value)}
                placeholder="Nombre del transportador"
                required
                value={transporter}
              />
            </FormField>
            <FormField htmlFor={`kit-tech-${kit.id}`} label="Técnico">
              <Select
                id={`kit-tech-${kit.id}`}
                onChange={(e) => setTechnicianId(e.target.value)}
                required
                value={technicianId}
              >
                <option value="">Seleccionar técnico…</option>
                {activeTechnicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <button
              className="panoptes-btn-primary inline-flex w-full items-center justify-center gap-2"
              disabled={!transporter.trim() || !technicianId}
              onClick={handleDispatch}
              type="button"
            >
              <span aria-hidden className="material-symbols-outlined text-base">
                sensors
              </span>
              Asignar y enviar
            </button>
            <DocumentPlaceholderButton />
          </section>
        )}

        {canConfirmHospital && (
          <section className="space-y-3 rounded-md border border-outline-variant/40 bg-surface-container/40 p-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
              <span aria-hidden className="material-symbols-outlined text-base text-primary">
                local_hospital
              </span>
              Confirmación de llegada al hospital
            </h4>
            <p className="text-xs text-on-surface-variant">
              El técnico confirma que el material llegó al hospital.
            </p>
            <RfidScanHint label="Confirmar llegada de productos vía lectura RFID (próximamente)." />
            {kit.shipped_at && (
              <p className="text-xs text-on-surface-variant">
                Enviado: {new Date(kit.shipped_at).toLocaleString('es-MX')}
              </p>
            )}
            <button
              className="panoptes-btn-primary inline-flex w-full items-center justify-center gap-2"
              onClick={handleConfirmHospital}
              type="button"
            >
              <span aria-hidden className="material-symbols-outlined text-base">
                contactless
              </span>
              Confirmar llegada al hospital
            </button>
            <DocumentPlaceholderButton />
          </section>
        )}

        {canEditChecklist && (
          <section className="space-y-3 rounded-md border border-outline-variant/40 bg-surface-container/40 p-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
              <span aria-hidden className="material-symbols-outlined text-base text-primary">
                checklist
              </span>
              Checklist de regreso a almacén
            </h4>
            <p className="text-xs text-on-surface-variant">
              El técnico marca el material que regresa al almacén.
            </p>
            <RfidScanHint label="Marcar productos de regreso vía lectura RFID (próximamente)." />
            <ul className="space-y-2">
              {checklist.map((item, index) => (
                <li key={item.code}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                    <input
                      checked={item.checked}
                      className="mt-0.5"
                      onChange={(e) => {
                        const next = [...checklist];
                        next[index] = { ...item, checked: e.target.checked };
                        setChecklist(next);
                      }}
                      type="checkbox"
                    />
                    <span aria-hidden className="material-symbols-outlined mt-0.5 text-base text-on-surface-variant">
                      contactless
                    </span>
                    <span>
                      <span className="font-mono text-xs text-on-surface-variant">{item.code}</span>
                      <span className="block font-medium">
                        {item.item_type?.trim() || 'Producto'}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {checklist.length === 0 && (
              <p className="text-xs text-on-surface-variant">No hay ítems en el checklist.</p>
            )}
            <button
              className="panoptes-btn-primary inline-flex w-full items-center justify-center gap-2"
              onClick={handleSaveChecklist}
              type="button"
            >
              <span aria-hidden className="material-symbols-outlined text-base">
                sensors
              </span>
              Guardar checklist
            </button>
            <DocumentPlaceholderButton />
          </section>
        )}

        {canConfirmWarehouse && (
          <section className="space-y-3 rounded-md border border-outline-variant/40 bg-surface-container/40 p-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
              <span aria-hidden className="material-symbols-outlined text-base text-primary">
                warehouse
              </span>
              Confirmación de llegada al almacén
            </h4>
            <p className="text-xs text-on-surface-variant">
              El almacén confirma que el material llegó y fue recibido.
            </p>
            <RfidScanHint label="Confirmar recepción de productos vía lectura RFID (próximamente)." />
            <button
              className="panoptes-btn-primary inline-flex w-full items-center justify-center gap-2"
              onClick={handleConfirmWarehouse}
              type="button"
            >
              <span aria-hidden className="material-symbols-outlined text-base">
                contactless
              </span>
              Confirmar llegada al almacén
            </button>
            <DocumentPlaceholderButton />
          </section>
        )}

        {kitStatus === 'devuelta' && (
          <section className="space-y-2 rounded-md border border-outline-variant/40 bg-surface-container/40 p-3">
            <p className="flex items-center gap-1.5 text-sm text-on-surface">
              <span aria-hidden className="material-symbols-outlined text-base text-primary">
                verified
              </span>
              Instrumental confirmado en almacén
              {kit.warehouse_confirmed_at
                ? ` · ${new Date(kit.warehouse_confirmed_at).toLocaleString('es-MX')}`
                : ''}
            </p>
            <DocumentPlaceholderButton />
          </section>
        )}
      </div>
    </article>
  );
}

const SupplyKits = () => {
  const data = useLoaderData<SupplyKitsLoaderData>();
  const revalidator = useRevalidator();
  const modules = useOptionalModules();
  const role = modules?.role ?? 'admin';
  const [searchParams] = useSearchParams();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [destination, setDestination] = useState('');
  const [procedureId, setProcedureId] = useState('');

  const refresh = () => revalidator.revalidate();

  const { active: activeKits, finalized: finalizedKits } = useMemo(
    () =>
      partitionByFinalized(data.results ?? [], (kit) => kit.status, isFinalizedKitStatus),
    [data.results],
  );

  const applyProcedure = (id: string) => {
    setProcedureId(id);
    const proc = data.proceduresWithoutKit.find((p) => String(p.id) === id);
    if (proc) {
      setDestination(proc.destination_hospital || '');
      if (!name) {
        setName(`Instrumental ${proc.procedure_type}`);
      }
      if (!code) {
        setCode(`MK-${proc.id}`);
      }
    }
  };

  const handleCreate = async () => {
    await supplyKitsCreate({
      body: {
        name,
        code,
        destination_hospital: destination,
        status: 'armando',
        procedure: procedureId ? Number(procedureId) : null,
      },
      throwOnError: true,
    });
    setName('');
    setCode('');
    setDestination('');
    setProcedureId('');
    refresh();
  };

  return (
    <AppLayout
      dense
      subtitle="Parte de Control de instrumental: armado → envío → hospital → almacén"
      title="Cargas RFID"
      tourId="supply-kits"
      actions={
        <Link className="panoptes-btn-secondary text-sm" to="/instrumental">
          <span className="material-symbols-outlined text-base">timeline</span>
          Ir al flujo
        </Link>
      }
    >
      <section className="panoptes-card mb-6 p-4" data-tour="material-examples">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-sm font-semibold text-on-surface">
          Tipos de material que se pueden enviar
        </h2>
        <p className="mb-3 text-xs text-on-surface-variant">
          Un mismo envío puede mezclar categorías. Ejemplos básicos:
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {MATERIAL_CATEGORY_EXAMPLES.map((category) => (
            <div
              key={category.key}
              className="rounded-md border border-outline-variant/40 bg-surface-container/40 px-3 py-2.5"
            >
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                <span aria-hidden className="material-symbols-outlined text-base text-primary">
                  {category.icon}
                </span>
                {category.label}
              </p>
              <ul className="space-y-0.5 text-xs text-on-surface-variant">
                {category.examples.map((example) => (
                  <li key={example}>· {example}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {data.proceduresWithoutKit.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-base font-semibold text-on-surface">
            Procedimientos sin instrumental
          </h2>
          <p className="mb-3 text-sm text-on-surface-variant">
            Estos procedimientos aún no tienen instrumental asignado. Elige uno para crearlo automáticamente.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.proceduresWithoutKit.map((proc) => (
              <button
                key={proc.id}
                className="panoptes-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
                onClick={() => applyProcedure(String(proc.id))}
                type="button"
              >
                <p className="font-semibold text-on-surface">{proc.procedure_type}</p>
                <p className="mt-1 text-sm text-on-surface-variant">{proc.destination_hospital}</p>
                {proc.doctor_name && (
                  <p className="mt-1 text-sm text-on-surface">Doctor: {proc.doctor_name}</p>
                )}
                <p className="mt-1 text-xs text-on-surface-variant">
                  {proc.scheduled_date
                    ? new Date(proc.scheduled_date).toLocaleDateString('es-MX')
                    : 'Sin fecha'}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  <span className="material-symbols-outlined text-sm">add_box</span>
                  Crear instrumental para este procedimiento
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div data-tour="kit-create">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Crear instrumental" title="Nuevo instrumental">
        <FormField htmlFor="kit-procedure" label="Procedimiento (opcional)">
          <Select
            id="kit-procedure"
            onChange={(e) => applyProcedure(e.target.value)}
            value={procedureId}
          >
            <option value="">Sin procedimiento</option>
            {data.proceduresWithoutKit.map((p) => (
              <option key={p.id} value={p.id}>
                {p.procedure_type} — {p.destination_hospital}
                {p.doctor_name ? ` (${p.doctor_name})` : ''}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="kit-code" label="Código">
          <Input id="kit-code" onChange={(e) => setCode(e.target.value)} placeholder="MK-001" required value={code} />
        </FormField>
        <FormField htmlFor="kit-name" label="Nombre">
          <Input
            id="kit-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Equipo + consumibles + instrumental"
            required
            value={name}
          />
        </FormField>
        <FormField htmlFor="kit-dest" label="Hospital destino">
          <Input id="kit-dest" onChange={(e) => setDestination(e.target.value)} value={destination} />
        </FormField>
      </FormPanel>
      </div>

      <Form className="panoptes-card mb-6 flex flex-wrap items-end gap-4 p-4" method="get">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">
            Estado
          </label>
          <select className="panoptes-input" defaultValue={data.filters.status} name="status">
            <option value="">Todos</option>
            {Object.entries(SUPPLY_KIT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button className="panoptes-btn-primary" type="submit">
          Filtrar
        </button>
        <input name="limit" type="hidden" value={searchParams.get('limit') || '20'} />
      </Form>

      <div className="space-y-8" data-tour="kit-list">
        {!data.results?.length ? (
          <div className="panoptes-card p-10 text-center text-on-surface-variant sm:p-14">
            No hay instrumental registrado.
          </div>
        ) : (
          <>
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-on-surface lg:text-lg">
                  En proceso
                </h2>
                <span className="text-xs text-on-surface-variant">{activeKits.length}</span>
              </div>
              {activeKits.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                  {activeKits.map((kit) => (
                    <SupplyKitCard
                      key={`${kit.id}-${kit.modified}-${kit.status}`}
                      kit={kit as SupplyKitWithTags}
                      onSaved={refresh}
                      proceduresWithoutKit={data.proceduresWithoutKit}
                      role={role}
                      tags={data.tags}
                      technicians={data.technicians}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container/40 px-4 py-6 text-center text-sm text-on-surface-variant">
                  No hay cargas activas. Las finalizadas están abajo.
                </p>
              )}
            </section>

            {finalizedKits.length > 0 && (
              <section>
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-on-surface-variant lg:text-lg">
                    Finalizados
                  </h2>
                  <span className="text-xs text-on-surface-variant">{finalizedKits.length}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                  {finalizedKits.map((kit) => (
                    <SupplyKitCard
                      key={`${kit.id}-${kit.modified}-${kit.status}`}
                      kit={kit as SupplyKitWithTags}
                      onSaved={refresh}
                      proceduresWithoutKit={data.proceduresWithoutKit}
                      role={role}
                      tags={data.tags}
                      technicians={data.technicians}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} instrumentales en total</span>
        <div className="flex gap-2">
          {prev ? (
            <Link className="panoptes-btn-primary" to={prev}>
              ← Anterior
            </Link>
          ) : (
            <span className="panoptes-btn-primary pointer-events-none opacity-40">← Anterior</span>
          )}
          {next ? (
            <Link className="panoptes-btn-primary" to={next}>
              Siguiente →
            </Link>
          ) : (
            <span className="panoptes-btn-primary pointer-events-none opacity-40">Siguiente →</span>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default SupplyKits;

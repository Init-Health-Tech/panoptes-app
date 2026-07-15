import { useEffect, useRef, useState } from 'react';
import { Form, Link, useLoaderData, useRevalidator, useSearchParams } from 'react-router';

import {
  inventoryLocationsCreate,
  requisitionsCreate,
  requisitionsPartialUpdate,
  type InventoryLocation,
  type PaginatedRequisitionList,
  type Product,
  type Requisition,
} from '@/js/api';
import { resolveScanProduct, type ScannedProduct } from '@/js/api/logistics';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { Button } from '@/js/components/ui/Button';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { Input } from '@/js/components/ui/Input';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';
import { Select } from '@/js/components/ui/Select';
import { REQUISITION_STATUS_LABELS } from '@/js/types/logistics';
import { makeLink } from '@/js/utils';
import { openRequisitionVale } from '@/js/utils/requisitionPdf';

type RequisitionsLoaderData = PaginatedRequisitionList & {
  filters: { status: string };
  products: Product[];
  locations: InventoryLocation[];
};

type DraftLine = {
  key: string;
  productId: number;
  sku: string;
  name: string;
  quantity: number;
};

const KANBAN_COLUMNS = ['solicitada', 'aprobada', 'en_transito', 'entregada'] as const;

function locationCode(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36);
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return `${base || 'UBIC'}-${suffix}`;
}

function RequisitionStatusEdit({ req, onSaved }: { req: Requisition; onSaved: () => void }) {
  const [status, setStatus] = useState(req.status ?? 'solicitada');

  const handleUpdate = async () => {
    await requisitionsPartialUpdate({
      path: { id: req.id },
      body: { status },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title={`REQ #${req.id}`}>
      <FormField htmlFor={`req-status-${req.id}`} label="Estado">
        <Select id={`req-status-${req.id}`} onChange={(e) => setStatus(e.target.value as typeof status)} value={status}>
          {Object.entries(REQUISITION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>
    </EditFormPanel>
  );
}

function ValeButtons({ req }: { req: Requisition }) {
  return (
    <div className="flex flex-wrap gap-1">
      <button
        className="inline-flex items-center gap-1 rounded-md border border-outline-variant/40 bg-surface-container px-2 py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface"
        onClick={() => openRequisitionVale(req, 'salida')}
        title="Generar vale de salida (PDF)"
        type="button"
      >
        <span className="material-symbols-outlined text-sm">upload_file</span>
        Salida
      </button>
      <button
        className="inline-flex items-center gap-1 rounded-md border border-outline-variant/40 bg-surface-container px-2 py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface"
        onClick={() => openRequisitionVale(req, 'entrada')}
        title="Generar vale de entrada (PDF)"
        type="button"
      >
        <span className="material-symbols-outlined text-sm">download</span>
        Entrada
      </button>
    </div>
  );
}

function LocationSelect({
  id,
  label,
  value,
  onChange,
  locations,
  onCreate,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  locations: InventoryLocation[];
  onCreate: (name: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await onCreate(name);
      setNewName('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormField htmlFor={id} label={label}>
      {adding ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            id={id}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="Nombre del lugar (ej. Sucursal Sur)"
            value={newName}
          />
          <Button disabled={busy} onClick={handleCreate} variant="secondary">
            {busy ? '…' : 'Crear'}
          </Button>
          <Button onClick={() => setAdding(false)} variant="ghost">
            ✕
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Select id={id} onChange={(e) => onChange(e.target.value)} value={value}>
            <option value="">Seleccionar…</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </Select>
          <Button icon="add" onClick={() => setAdding(true)} variant="secondary">
            Nueva
          </Button>
        </div>
      )}
    </FormField>
  );
}

function NewRequisitionForm({
  products,
  initialLocations,
  onCreated,
}: {
  products: Product[];
  initialLocations: InventoryLocation[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<InventoryLocation[]>(initialLocations);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [mode, setMode] = useState<'manual' | 'rfid'>('manual');

  const [manualProductId, setManualProductId] = useState('');
  const [manualQty, setManualQty] = useState('1');

  const [scanValue, setScanValue] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocations(initialLocations);
  }, [initialLocations]);

  useEffect(() => {
    if (mode === 'rfid' && open) scanRef.current?.focus();
  }, [mode, open]);

  const addOrIncrement = (product: ScannedProduct, qty: number) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return copy;
      }
      return [
        ...prev,
        {
          key: `${product.id}-${Date.now()}`,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: qty,
        },
      ];
    });
  };

  const handleAddManual = () => {
    const product = products.find((p) => String(p.id) === manualProductId);
    const qty = Math.max(1, Number(manualQty) || 1);
    if (!product) return;
    addOrIncrement({ id: product.id, sku: product.sku, name: product.name }, qty);
    setManualProductId('');
    setManualQty('1');
  };

  const handleScan = async () => {
    const identifier = scanValue.trim();
    if (!identifier) return;
    try {
      const result = await resolveScanProduct(identifier);
      addOrIncrement(result.product, 1);
      setScanFeedback({ type: 'ok', msg: `+1 ${result.product.name} (${result.product.sku})` });
      setScanValue('');
      scanRef.current?.focus();
    } catch (err) {
      setScanFeedback({ type: 'error', msg: (err as Error).message });
    }
  };

  const updateQty = (key: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, qty) } : l)),
    );
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const handleCreateLocation = async (name: string, target: 'origin' | 'destination') => {
    const response = await inventoryLocationsCreate({
      body: { name, code: locationCode(name), location_type: 'other', is_active: true },
      throwOnError: true,
    });
    const created = response.data;
    setLocations((prev) => [...prev, created]);
    if (target === 'origin') setOrigin(created.name);
    else setDestination(created.name);
  };

  const resetForm = () => {
    setOrigin('');
    setDestination('');
    setLines([]);
    setManualProductId('');
    setManualQty('1');
    setScanValue('');
    setScanFeedback(null);
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    if (!origin || !destination) {
      setError('Selecciona un origen y un destino del catálogo.');
      return;
    }
    if (lines.length === 0) {
      setError('Agrega al menos un producto (manual o por RFID).');
      return;
    }
    setSaving(true);
    try {
      await requisitionsCreate({
        body: {
          origin,
          destination,
          status: 'solicitada',
          lines: lines.map((l) => ({ product: l.productId, quantity: l.quantity })),
        },
        throwOnError: true,
      });
      resetForm();
      setOpen(false);
      onCreated();
    } catch {
      setError('No se pudo crear la requisición. Verifica los datos e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0);

  if (!open) {
    return (
      <Button className="mb-4" icon="add" onClick={() => setOpen(true)}>
        Nueva requisición
      </Button>
    );
  }

  return (
    <section className="panoptes-card mb-6 space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold text-on-surface">
          Nueva requisición
        </h2>
        <button
          className="text-on-surface-variant hover:text-on-surface"
          onClick={() => setOpen(false)}
          type="button"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LocationSelect
          id="req-origin"
          label="Origen"
          locations={locations}
          onChange={setOrigin}
          onCreate={(name) => handleCreateLocation(name, 'origin')}
          value={origin}
        />
        <LocationSelect
          id="req-dest"
          label="Destino (a dónde se envía)"
          locations={locations}
          onChange={setDestination}
          onCreate={(name) => handleCreateLocation(name, 'destination')}
          value={destination}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-on-surface-variant">Productos</span>
          <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-outline-variant/40">
            <button
              className={`px-3 py-1 text-xs font-medium ${
                mode === 'manual' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
              }`}
              onClick={() => setMode('manual')}
              type="button"
            >
              Manual
            </button>
            <button
              className={`px-3 py-1 text-xs font-medium ${
                mode === 'rfid' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
              }`}
              onClick={() => setMode('rfid')}
              type="button"
            >
              RFID / Handheld
            </button>
          </div>
        </div>

        {mode === 'manual' ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Select
                id="req-manual-product"
                onChange={(e) => setManualProductId(e.target.value)}
                value={manualProductId}
              >
                <option value="">Seleccionar producto…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-24">
              <Input
                aria-label="Cantidad"
                min={1}
                onChange={(e) => setManualQty(e.target.value)}
                type="number"
                value={manualQty}
              />
            </div>
            <Button disabled={!manualProductId} icon="add" onClick={handleAddManual} variant="secondary">
              Agregar
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[240px] flex-1">
                <input
                  className="panoptes-input"
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleScan();
                    }
                  }}
                  placeholder="Escanea RFID (EPC/ASCII) o teclea el SKU…"
                  ref={scanRef}
                  value={scanValue}
                />
              </div>
              <Button icon="nfc" onClick={handleScan} variant="secondary">
                Leer
              </Button>
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">
              Cada lectura suma +1 al producto. Con el handheld, cada disparo llega como “Enter”.
            </p>
            {scanFeedback && (
              <p
                className={`mt-1 text-xs font-medium ${
                  scanFeedback.type === 'ok' ? 'text-primary' : 'text-error'
                }`}
              >
                {scanFeedback.msg}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-lg border border-outline-variant/30">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-on-surface-variant">SKU</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-on-surface-variant">Producto</th>
                <th className="w-28 px-3 py-2 text-left text-xs font-semibold uppercase text-on-surface-variant">Cantidad</th>
                <th className="w-12 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-on-surface-variant" colSpan={4}>
                    Sin productos aún. Agrégalos manual o por RFID.
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.key} className="border-t border-outline-variant/20">
                    <td className="px-3 py-2 font-mono text-xs">{line.sku}</td>
                    <td className="px-3 py-2">{line.name}</td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label={`Cantidad ${line.name}`}
                        min={1}
                        onChange={(e) => updateQty(line.key, Number(e.target.value))}
                        type="number"
                        value={line.quantity}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-on-surface-variant hover:text-error"
                        onClick={() => removeLine(line.key)}
                        title="Quitar"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {lines.length > 0 && (
          <p className="mt-1 text-right text-xs text-on-surface-variant">
            {lines.length} productos · {totalUnits} piezas
          </p>
        )}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-2">
        <Button disabled={saving} onClick={handleSubmit}>
          {saving ? 'Creando…' : 'Crear requisición'}
        </Button>
        <Button onClick={() => setOpen(false)} variant="secondary">
          Cancelar
        </Button>
      </div>
    </section>
  );
}

const Requisitions = () => {
  const data = useLoaderData<RequisitionsLoaderData>();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const activeStatus = data.filters.status;
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);

  const refresh = () => revalidator.revalidate();

  const grouped = KANBAN_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = (data.results ?? []).filter((r) => r.status === status);
      return acc;
    },
    {} as Record<string, NonNullable<typeof data.results>>,
  );

  return (
    <AppLayout subtitle="Requisiciones de envío entre ubicaciones" title="Requisiciones">
      <NewRequisitionForm
        initialLocations={data.locations}
        onCreated={refresh}
        products={data.products}
      />

      <Form className="panoptes-card mb-6 flex flex-wrap items-end gap-4 p-4" method="get">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">
            Filtrar por estado
          </label>
          <select className="panoptes-input" defaultValue={activeStatus} name="status">
            <option value="">Todos (vista kanban)</option>
            {Object.entries(REQUISITION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button className="panoptes-btn-primary" type="submit">
          Aplicar
        </button>
        <input name="limit" type="hidden" value={searchParams.get('limit') || '20'} />
      </Form>

      {!activeStatus ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {KANBAN_COLUMNS.map((status) => (
            <section key={status} className="panoptes-card p-4">
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase text-on-surface-variant">
                  {REQUISITION_STATUS_LABELS[status]}
                </h3>
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold">
                  {grouped[status]?.length ?? 0}
                </span>
              </header>
              <div className="space-y-2">
                {(grouped[status] ?? []).map((req) => (
                  <article
                    key={req.id}
                    className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-primary">REQ #{req.id}</p>
                      <RequisitionStatusEdit onSaved={refresh} req={req} />
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {req.origin} → {req.destination}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {req.lines?.length ?? 0} productos
                    </p>
                    <div className="mt-2">
                      <ValeButtons req={req} />
                    </div>
                  </article>
                ))}
                {!grouped[status]?.length && (
                  <p className="text-xs text-on-surface-variant">Sin requisiciones</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="panoptes-card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="panoptes-table-header">ID</th>
                <th className="panoptes-table-header">Origen</th>
                <th className="panoptes-table-header">Destino</th>
                <th className="panoptes-table-header">Estado</th>
                <th className="panoptes-table-header">Líneas</th>
                <th className="panoptes-table-header">Documentos</th>
                <th className="panoptes-table-header w-16"></th>
              </tr>
            </thead>
            <tbody>
              {data.results?.map((req) => (
                <tr key={req.id} className="panoptes-table-row">
                  <td className="px-4 py-3 font-mono">#{req.id}</td>
                  <td className="px-4 py-3">{req.origin}</td>
                  <td className="px-4 py-3">{req.destination}</td>
                  <td className="px-4 py-3">
                    <KitStatusBadge labels={REQUISITION_STATUS_LABELS} status={req.status ?? 'solicitada'} />
                  </td>
                  <td className="px-4 py-3">{req.lines?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <ValeButtons req={req} />
                  </td>
                  <td className="px-4 py-3">
                    <RequisitionStatusEdit onSaved={refresh} req={req} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} requisiciones</span>
        <div className="flex gap-2">
          {prev && <Link className="panoptes-btn-primary" to={prev}>← Anterior</Link>}
          {next && <Link className="panoptes-btn-primary" to={next}>Siguiente →</Link>}
        </div>
      </div>
    </AppLayout>
  );
};

export default Requisitions;

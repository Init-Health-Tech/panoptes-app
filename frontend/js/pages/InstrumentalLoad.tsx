import { Link, useLoaderData, useNavigate, useRevalidator } from 'react-router';
import { useEffect, useMemo, useState } from 'react';

import {
  instrumentalHandheldScansCreate,
  materialDispatchesUnloadCreate,
  type FulfillmentPlan,
  type HospitalSite,
  type InstrumentProcedureRequest,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { ActionModal } from '@/js/components/ui/ActionModal';
import { Checkbox } from '@/js/components/ui/Checkbox';
import { ConfirmDialog } from '@/js/components/ui/ConfirmDialog';
import { FormField } from '@/js/components/ui/FormField';
import { Input } from '@/js/components/ui/Input';
import {
  dispatchIdentifier,
  buildMatchRows,
  LOADABLE_STATUSES,
  MaterialMatchSummary,
  REMOVABLE_FROM_LOAD,
} from '@/js/components/ui/MaterialMatchSummary';
import { RfidScanHint } from '@/js/components/ui/RfidScanHint';
import { Select } from '@/js/components/ui/Select';

type PendingConfirm =
  | { type: 'load'; count: number }
  | { type: 'scan'; code: string }
  | { type: 'unload'; dispatchId: number; label: string };

const DISPATCH_LABELS: Record<string, string> = {
  assigned: 'Asignado',
  sterilizing: 'Esterilizando',
  loaded: 'Cargado',
  in_transit: 'En tránsito',
  at_hospital: 'En hospital',
  returning: 'Retornando',
  returned: 'Retornado',
  validated: 'Validado',
};

type LoaderData = {
  request: InstrumentProcedureRequest;
  plan: FulfillmentPlan | null;
  hospitals: HospitalSite[];
  returnTo: string;
};

const InstrumentalLoad = () => {
  const data = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const req = data.request;
  const dispatches = data.plan?.dispatches ?? [];
  const matchRows = useMemo(() => buildMatchRows(req, dispatches), [req, dispatches]);
  const loadable = dispatches.filter((d) => LOADABLE_STATUSES.has(d.status ?? ''));
  const removable = dispatches.filter((d) => REMOVABLE_FROM_LOAD.has(d.status ?? ''));
  const centralWarehouse = data.hospitals.find((h) => h.is_central);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [identifier, setIdentifier] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    setSelectedIds(loadable.map((d) => d.id));
    // Reset selection when plan units available for load change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadable.map((d) => d.id).join(',')]);

  const refresh = () => revalidator.revalidate();

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const registerScan = async (code: string) => {
    const response = await instrumentalHandheldScansCreate({
      body: {
        identifier: code,
        event_type: 'load_departure',
        hospital: hospitalId ? Number(hospitalId) : centralWarehouse?.id,
        handheld_id: 'HH-LOAD-01',
      },
      throwOnError: true,
    });
    return response.data as { dispatch_status?: string; tracking_identifier?: string };
  };

  const afterSuccess = (message: string) => {
    setDoneMessage(message);
    setDoneOpen(true);
    refresh();
  };

  const requestManualLoad = () => {
    if (!selectedIds.length) return;
    setPendingConfirm({ type: 'load', count: selectedIds.length });
  };

  const requestScan = () => {
    const code = identifier.trim();
    if (!code) return;
    setPendingConfirm({ type: 'scan', code });
  };

  const requestUnload = (dispatchId: number, label: string) => {
    setPendingConfirm({ type: 'unload', dispatchId, label });
  };

  const executeConfirm = async () => {
    if (!pendingConfirm) return;
    const action = pendingConfirm;
    setBusy(true);
    setError('');
    try {
      if (action.type === 'load') {
        const selected = loadable.filter((d) => selectedIds.includes(d.id));
        let count = 0;
        for (const dispatch of selected) {
          const code = dispatchIdentifier(dispatch);
          if (!code) continue;
          await registerScan(code);
          count += 1;
        }
        setSelectedIds([]);
        setPendingConfirm(null);
        afterSuccess(`Se cargaron ${count} producto(s) correctamente.`);
      } else if (action.type === 'scan') {
        const payload = await registerScan(action.code);
        setIdentifier('');
        setPendingConfirm(null);
        afterSuccess(
          `Escaneo OK: ${payload.tracking_identifier ?? action.code} → ${payload.dispatch_status ?? 'cargado'}`,
        );
      } else {
        await materialDispatchesUnloadCreate({ path: { id: action.dispatchId }, throwOnError: true });
        setPendingConfirm(null);
        afterSuccess('Producto quitado de la carga.');
      }
    } catch {
      setPendingConfirm(null);
      if (action.type === 'load') {
        setError('No se pudo cargar uno o más productos. Revisa disponibilidad y custodia.');
      } else if (action.type === 'scan') {
        setError('No se reconoció el identificador o no hay despacho activo.');
      } else {
        setError('No se pudo quitar el producto de la carga.');
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy =
    pendingConfirm?.type === 'load'
      ? {
          title: 'Confirmar carga',
          message: `¿Cargar ${pendingConfirm.count} producto(s) seleccionado(s)?`,
          confirmLabel: 'Cargar',
          danger: false,
        }
      : pendingConfirm?.type === 'scan'
        ? {
            title: 'Confirmar escaneo',
            message: `¿Registrar escaneo de «${pendingConfirm.code}»?`,
            confirmLabel: 'Registrar',
            danger: false,
          }
        : pendingConfirm?.type === 'unload'
          ? {
              title: 'Quitar de la carga',
              message: `¿Quitar «${pendingConfirm.label}» de la carga?`,
              confirmLabel: 'Quitar',
              danger: true,
            }
          : null;

  const goBack = () => navigate(data.returnTo);

  return (
    <AppLayout
      subtitle={`REQ-${req.id} · ${req.procedure_type}`}
      title="Cargar material"
      actions={
        <Link className="panoptes-btn-secondary text-sm" to={data.returnTo}>
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver
        </Link>
      }
    >
      {!data.plan ? (
        <div className="panoptes-card p-6 text-center text-on-surface-variant">
          Esta solicitud aún no tiene plan de despacho.
          <div className="mt-4">
            <Link className="panoptes-btn-primary" to={data.returnTo}>
              Volver al flujo
            </Link>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-xl space-y-5 pb-28 lg:max-w-3xl">
          <section className="panoptes-card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-on-surface">Match vs solicitado</h2>
            <MaterialMatchSummary rows={matchRows} />
          </section>

          {removable.length > 0 && (
            <section className="panoptes-card space-y-3 p-4">
              <h2 className="text-sm font-semibold text-on-surface">En la carga</h2>
              <ul className="space-y-2">
                {removable.map((dispatch) => (
                  <li
                    key={dispatch.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-on-surface">{dispatch.catalog_name || 'Producto'}</p>
                      <p className="font-mono text-xs text-on-surface-variant">
                        {dispatchIdentifier(dispatch) || 'Sin código'}
                      </p>
                    </div>
                    <button
                      className="min-h-11 shrink-0 px-2 text-sm font-semibold text-error"
                      disabled={busy}
                      onClick={() =>
                        requestUnload(dispatch.id, dispatch.catalog_name || dispatchIdentifier(dispatch))
                      }
                      type="button"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panoptes-card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-on-surface">Disponibles para cargar</h2>
            <p className="text-xs text-on-surface-variant">
              Marca los productos del plan y confirma la carga. También puedes escanear abajo.
            </p>
            {loadable.length ? (
              <ul className="space-y-2">
                {loadable.map((dispatch) => {
                  const checked = selectedIds.includes(dispatch.id);
                  return (
                    <li key={dispatch.id}>
                      <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border border-outline-variant/40 bg-surface-container/40 px-3 py-3">
                        <Checkbox
                          checked={checked}
                          className="mt-1"
                          onChange={() => toggleSelected(dispatch.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-on-surface">
                            {dispatch.catalog_name || 'Producto'}
                          </span>
                          <span className="block font-mono text-xs text-on-surface-variant">
                            {dispatchIdentifier(dispatch) || 'Sin código'}
                          </span>
                          <span className="block text-xs text-on-surface-variant">
                            {DISPATCH_LABELS[dispatch.status ?? ''] ?? dispatch.status}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-md bg-surface-container px-3 py-4 text-center text-sm text-on-surface-variant">
                No hay productos pendientes de carga.
              </p>
            )}
          </section>

          <section className="panoptes-card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-on-surface">Escanear RFID / SKU</h2>
            <RfidScanHint label="Alternativa al listado manual." />
            <FormField htmlFor="load-scan" label="Código">
              <Input
                id="load-scan"
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="AVANT0000011 o SKU-…"
                value={identifier}
              />
            </FormField>
            <FormField htmlFor="load-hospital" label="Hospital (opcional)">
              <Select id="load-hospital" onChange={(e) => setHospitalId(e.target.value)} value={hospitalId}>
                <option value="">Auto (almacén central si aplica)</option>
                {data.hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                    {h.is_central ? ' (almacén central)' : ''}
                  </option>
                ))}
              </Select>
            </FormField>
            <button
              className="panoptes-btn-secondary w-full"
              disabled={busy || !identifier.trim()}
              onClick={requestScan}
              type="button"
            >
              <span className="material-symbols-outlined text-base">contactless</span>
              Registrar escaneo
            </button>
          </section>

          {error && <p className="text-sm text-error">{error}</p>}
        </div>
      )}

      {data.plan && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-outline-variant/40 bg-surface-container-lowest/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:left-[var(--sidebar-offset,16rem)]">
          <div className="mx-auto flex max-w-xl gap-2 lg:max-w-3xl">
            <button className="panoptes-btn-secondary flex-1" onClick={goBack} type="button">
              Volver
            </button>
            <button
              className="panoptes-btn-primary flex-[1.4]"
              disabled={busy || selectedIds.length === 0}
              onClick={requestManualLoad}
              type="button"
            >
              {busy ? 'Cargando…' : `Cargar (${selectedIds.length})`}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        busy={busy}
        cancelLabel="Cancelar"
        confirmLabel={confirmCopy?.confirmLabel}
        danger={confirmCopy?.danger}
        message={confirmCopy?.message ?? ''}
        onCancel={() => {
          if (!busy) setPendingConfirm(null);
        }}
        onConfirm={executeConfirm}
        open={Boolean(pendingConfirm && confirmCopy)}
        title={confirmCopy?.title ?? 'Confirmar'}
      />

      <ActionModal
        onClose={() => setDoneOpen(false)}
        open={doneOpen}
        subtitle={doneMessage}
        title="Carga actualizada"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="panoptes-btn-primary w-full"
              onClick={() => {
                setDoneOpen(false);
                goBack();
              }}
              type="button"
            >
              Volver al flujo
            </button>
            <button
              className="panoptes-btn-secondary w-full"
              onClick={() => setDoneOpen(false)}
              type="button"
            >
              Seguir ajustando
            </button>
          </div>
        }
      >
        <p className="text-sm text-on-surface-variant">
          ¿Quieres regresar al flujo instrumental o seguir cargando / quitando material?
        </p>
      </ActionModal>
    </AppLayout>
  );
};

export default InstrumentalLoad;

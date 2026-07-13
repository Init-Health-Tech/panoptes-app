import { Link, useLoaderData, useNavigate, useRevalidator, useSearchParams } from 'react-router';
import { useEffect, useMemo, useState } from 'react';

import {
  instrumentalHandheldScansCreate,
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
  buildChecklistMatchRows,
  CHECKLIST_PHASES,
  dispatchIdentifier,
  MaterialMatchSummary,
  type ChecklistPhase,
} from '@/js/components/ui/MaterialMatchSummary';
import { RfidScanHint } from '@/js/components/ui/RfidScanHint';
import { Select } from '@/js/components/ui/Select';

type LoaderData = {
  request: InstrumentProcedureRequest;
  plan: FulfillmentPlan | null;
  hospitals: HospitalSite[];
  returnTo: string;
};

function resolvePhase(raw: string | null): ChecklistPhase {
  if (raw && CHECKLIST_PHASES[raw]) return CHECKLIST_PHASES[raw];
  return CHECKLIST_PHASES.hospital_arrival;
}

const InstrumentalEvent = () => {
  const data = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const req = data.request;
  const dispatches = data.plan?.dispatches ?? [];
  const phase = resolvePhase(searchParams.get('type'));
  const centralWarehouse = data.hospitals.find((h) => h.is_central);
  const destinationHospital = data.hospitals.find((h) => h.id === req.destination_hospital);

  const pending = useMemo(
    () => dispatches.filter((d) => phase.pendingStatuses.includes(d.status ?? '')),
    [dispatches, phase],
  );
  const done = useMemo(
    () => dispatches.filter((d) => phase.doneStatuses.includes(d.status ?? '')),
    [dispatches, phase],
  );
  const matchRows = useMemo(
    () => buildChecklistMatchRows(req, dispatches, phase),
    [req, dispatches, phase],
  );

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [identifier, setIdentifier] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCount, setConfirmCount] = useState(0);

  useEffect(() => {
    setHospitalId(
      phase.event === 'hospital_arrival' && destinationHospital
        ? String(destinationHospital.id)
        : phase.event === 'return_arrival' || phase.event === 'crcao_validation'
          ? String(centralWarehouse?.id ?? '')
          : '',
    );
  }, [phase.event, destinationHospital?.id, centralWarehouse?.id]);

  // Keep selection only for items still pending (never auto-check all)
  useEffect(() => {
    const pendingIds = new Set(pending.map((d) => d.id));
    setSelectedIds((prev) => prev.filter((id) => pendingIds.has(id)));
  }, [pending]);

  const goBack = () => navigate(data.returnTo);
  const refresh = () => revalidator.revalidate();

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectByIdentifier = (code: string) => {
    const normalized = code.trim().toLowerCase();
    const match = pending.find((d) => {
      const id = dispatchIdentifier(d).toLowerCase();
      return id === normalized || d.catalog_sku?.toLowerCase() === normalized || d.sku?.toLowerCase() === normalized;
    });
    if (match) {
      setSelectedIds((prev) => (prev.includes(match.id) ? prev : [...prev, match.id]));
      return match;
    }
    return null;
  };

  const registerEvent = async (code: string) => {
    const response = await instrumentalHandheldScansCreate({
      body: {
        identifier: code,
        event_type: phase.event,
        hospital: hospitalId
          ? Number(hospitalId)
          : phase.event === 'hospital_arrival'
            ? destinationHospital?.id
            : centralWarehouse?.id,
        handheld_id: 'HH-CHECKLIST-01',
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

  const requestConfirmSelected = () => {
    if (!selectedIds.length) return;
    setConfirmCount(selectedIds.length);
    setConfirmOpen(true);
  };

  const executeConfirmSelected = async () => {
    if (!selectedIds.length) return;
    setBusy(true);
    setError('');
    try {
      const selected = pending.filter((d) => selectedIds.includes(d.id));
      let count = 0;
      for (const dispatch of selected) {
        const code = dispatchIdentifier(dispatch);
        if (!code) continue;
        await registerEvent(code);
        count += 1;
      }
      setSelectedIds([]);
      setConfirmOpen(false);
      afterSuccess(`Se registraron ${count} producto(s) en «${phase.title}».`);
    } catch {
      setConfirmOpen(false);
      setError('No se pudo registrar uno o más productos. Revisa el estado del despacho.');
    } finally {
      setBusy(false);
    }
  };

  const handleScan = () => {
    if (!identifier.trim()) return;
    setError('');
    const matched = selectByIdentifier(identifier);
    if (!matched) {
      setError('Ese código no está en los pendientes de este checklist.');
      return;
    }
    setIdentifier('');
  };

  const allDone = pending.length === 0 && done.length > 0;

  return (
    <AppLayout
      subtitle={`REQ-${req.id} · ${req.procedure_type}`}
      title={phase.title}
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
          <p className="text-sm text-on-surface-variant">{phase.subtitle}</p>

          <section className="panoptes-card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-on-surface">Match del checklist</h2>
            <p className="text-xs text-on-surface-variant">
              Esp. = unidades del viaje · OK = ya confirmadas en este paso · Sol. = pedido original
            </p>
            <MaterialMatchSummary mode="checklist" rows={matchRows} />
            {allDone && (
              <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                Checklist completo. Puedes volver al flujo.
              </p>
            )}
          </section>

          {done.length > 0 && (
            <section className="panoptes-card space-y-3 p-4">
              <h2 className="text-sm font-semibold text-on-surface">{phase.doneLabel}</h2>
              <ul className="space-y-2">
                {done.map((dispatch) => (
                  <li
                    key={dispatch.id}
                    className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3"
                  >
                    <span className="material-symbols-outlined text-base text-primary">check_circle</span>
                    <span className="min-w-0">
                      <span className="block font-medium text-on-surface">
                        {dispatch.catalog_name || 'Producto'}
                      </span>
                      <span className="block font-mono text-xs text-on-surface-variant">
                        {dispatchIdentifier(dispatch) || 'Sin código'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panoptes-card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-on-surface">Pendientes de confirmar</h2>
            <p className="text-xs text-on-surface-variant">
              Nada viene marcado: selecciona manualmente o lee RFID/SKU para añadir al checklist.
            </p>
            {pending.length ? (
              <ul className="space-y-2">
                {pending.map((dispatch) => {
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
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-md bg-surface-container px-3 py-4 text-center text-sm text-on-surface-variant">
                No hay productos pendientes en este checklist.
              </p>
            )}
          </section>

          <section className="panoptes-card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-on-surface">Escanear RFID / SKU</h2>
            <RfidScanHint label="La lectura solo marca el producto; luego confirma abajo." />
            <FormField htmlFor="chk-scan" label="Código">
              <Input
                id="chk-scan"
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleScan();
                  }
                }}
                placeholder="AVANT0000011 o SKU-…"
                value={identifier}
              />
            </FormField>
            {(phase.event === 'hospital_arrival' ||
              phase.event === 'return_arrival' ||
              phase.event === 'crcao_validation') && (
              <FormField htmlFor="chk-hospital" label="Sede">
                <Select id="chk-hospital" onChange={(e) => setHospitalId(e.target.value)} value={hospitalId}>
                  <option value="">Auto</option>
                  {data.hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                      {h.is_central ? ' (almacén central)' : ''}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            <button
              className="panoptes-btn-secondary w-full"
              disabled={!identifier.trim()}
              onClick={handleScan}
              type="button"
            >
              <span className="material-symbols-outlined text-base">contactless</span>
              Marcar por código
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
              onClick={requestConfirmSelected}
              type="button"
            >
              {busy ? 'Registrando…' : `${phase.confirmLabel} (${selectedIds.length})`}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        busy={busy}
        confirmLabel={phase.confirmLabel}
        message={`¿${phase.confirmLabel} de ${confirmCount} producto(s)?`}
        onCancel={() => {
          if (!busy) setConfirmOpen(false);
        }}
        onConfirm={executeConfirmSelected}
        open={confirmOpen}
        title="Confirmar acción"
      />

      <ActionModal
        onClose={() => setDoneOpen(false)}
        open={doneOpen}
        subtitle={doneMessage}
        title="Checklist actualizado"
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
            <button className="panoptes-btn-secondary w-full" onClick={() => setDoneOpen(false)} type="button">
              Seguir con el checklist
            </button>
          </div>
        }
      >
        <p className="text-sm text-on-surface-variant">
          Revisa el match arriba. Si ya está completo, regresa al flujo; si faltan, continúa.
        </p>
      </ActionModal>
    </AppLayout>
  );
};

export default InstrumentalEvent;

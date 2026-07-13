import type { EventTypeEnum, InstrumentProcedureRequest, MaterialDispatch } from '@/js/api';

export const LOADED_STATUSES = new Set([
  'loaded',
  'in_transit',
  'at_hospital',
  'returning',
  'returned',
  'validated',
]);
export const LOADABLE_STATUSES = new Set(['assigned', 'sterilizing']);
export const REMOVABLE_FROM_LOAD = new Set(['loaded', 'in_transit']);

export type MatchRow = {
  catalogId: number;
  name: string;
  sku: string;
  requested: number;
  planned: number;
  loaded: number;
};

export type ChecklistPhase = {
  title: string;
  subtitle: string;
  event: EventTypeEnum;
  /** Units still waiting for this checkpoint */
  pendingStatuses: string[];
  /** Units already past this checkpoint */
  doneStatuses: string[];
  confirmLabel: string;
  doneLabel: string;
};

export const CHECKLIST_PHASES: Record<string, ChecklistPhase> = {
  hospital_arrival: {
    title: 'Llegada al hospital',
    subtitle: 'Confirma cada producto que llega (manual o RFID)',
    event: 'hospital_arrival',
    pendingStatuses: ['loaded', 'in_transit'],
    doneStatuses: ['at_hospital', 'returning', 'returned', 'validated'],
    confirmLabel: 'Confirmar llegada',
    doneLabel: 'Ya en hospital',
  },
  hospital_departure: {
    title: 'Salida del hospital',
    subtitle: 'Checklist de material que sale de hospital hacia almacén',
    event: 'hospital_departure',
    pendingStatuses: ['at_hospital'],
    doneStatuses: ['returning', 'returned', 'validated'],
    confirmLabel: 'Confirmar salida',
    doneLabel: 'En retorno',
  },
  return_arrival: {
    title: 'Llegada al almacén',
    subtitle: 'Confirma cada producto que llega al almacén (manual o RFID)',
    event: 'return_arrival',
    pendingStatuses: ['returning', 'at_hospital'],
    doneStatuses: ['returned', 'validated'],
    confirmLabel: 'Confirmar llegada',
    doneLabel: 'Ya en almacén',
  },
  crcao_validation: {
    title: 'Validación en almacén',
    subtitle: 'Checklist final: valida cada producto y libera custodia',
    event: 'crcao_validation',
    pendingStatuses: ['returned', 'returning'],
    doneStatuses: ['validated'],
    confirmLabel: 'Validar seleccionados',
    doneLabel: 'Validado',
  },
};

export function buildMatchRows(req: InstrumentProcedureRequest, dispatches: MaterialDispatch[]): MatchRow[] {
  const map = new Map<number, MatchRow>();

  for (const line of req.lines ?? []) {
    map.set(line.catalog_item, {
      catalogId: line.catalog_item,
      name: line.catalog_name || 'Producto',
      sku: line.catalog_sku || '',
      requested: line.quantity ?? 1,
      planned: 0,
      loaded: 0,
    });
  }

  for (const dispatch of dispatches) {
    let row = map.get(dispatch.catalog_item);
    if (!row) {
      row = {
        catalogId: dispatch.catalog_item,
        name: dispatch.catalog_name || 'Producto',
        sku: dispatch.catalog_sku || dispatch.sku || '',
        requested: 0,
        planned: 0,
        loaded: 0,
      };
      map.set(dispatch.catalog_item, row);
    }
    row.planned += 1;
    if (LOADED_STATUSES.has(dispatch.status ?? '')) row.loaded += 1;
  }

  return [...map.values()];
}

/** Match checklist progress: expected = pending+done in scope, confirmed = done. */
export function buildChecklistMatchRows(
  req: InstrumentProcedureRequest,
  dispatches: MaterialDispatch[],
  phase: ChecklistPhase,
): MatchRow[] {
  const inScope = new Set([...phase.pendingStatuses, ...phase.doneStatuses]);
  const map = new Map<number, MatchRow>();

  for (const line of req.lines ?? []) {
    map.set(line.catalog_item, {
      catalogId: line.catalog_item,
      name: line.catalog_name || 'Producto',
      sku: line.catalog_sku || '',
      requested: line.quantity ?? 1,
      planned: 0,
      loaded: 0,
    });
  }

  for (const dispatch of dispatches) {
    const status = dispatch.status ?? '';
    if (!inScope.has(status) && !LOADED_STATUSES.has(status) && status !== 'assigned') {
      continue;
    }
    let row = map.get(dispatch.catalog_item);
    if (!row) {
      row = {
        catalogId: dispatch.catalog_item,
        name: dispatch.catalog_name || 'Producto',
        sku: dispatch.catalog_sku || dispatch.sku || '',
        requested: 0,
        planned: 0,
        loaded: 0,
      };
      map.set(dispatch.catalog_item, row);
    }
    if (inScope.has(status) || LOADED_STATUSES.has(status)) {
      row.planned += 1; // expected in this trip / checkpoint scope
    }
    if (phase.doneStatuses.includes(status)) {
      row.loaded += 1; // confirmed at this checkpoint
    }
  }

  return [...map.values()];
}

export function matchTone(row: MatchRow): { label: string; className: string } {
  if (row.requested === 0 && row.planned > 0) {
    return { label: `De más (+${row.planned})`, className: 'text-amber-800' };
  }
  if (row.loaded < row.requested) {
    return { label: `Faltan ${row.requested - row.loaded}`, className: 'text-error' };
  }
  if (row.loaded > row.requested) {
    return { label: `De más (+${row.loaded - row.requested})`, className: 'text-amber-800' };
  }
  if (row.planned < row.requested) {
    return { label: `Plan incompleto (−${row.requested - row.planned})`, className: 'text-amber-800' };
  }
  return { label: 'Completo', className: 'text-primary' };
}

export function checklistTone(row: MatchRow): { label: string; className: string } {
  if (row.loaded < row.planned) {
    return { label: `Faltan ${row.planned - row.loaded}`, className: 'text-error' };
  }
  if (row.loaded > row.planned && row.planned > 0) {
    return { label: `De más (+${row.loaded - row.planned})`, className: 'text-amber-800' };
  }
  if (row.requested > 0 && row.planned < row.requested) {
    return { label: `Vs solicitud: faltan ${row.requested - row.planned}`, className: 'text-amber-800' };
  }
  if (row.requested > 0 && row.planned > row.requested) {
    return { label: `Vs solicitud: de más (+${row.planned - row.requested})`, className: 'text-amber-800' };
  }
  return { label: 'Completo', className: 'text-primary' };
}

export function dispatchIdentifier(dispatch: MaterialDispatch) {
  return dispatch.rfid_code || dispatch.tracking_identifier || dispatch.sku || dispatch.catalog_sku || '';
}

export function MaterialMatchSummary({
  rows,
  mode = 'load',
}: {
  rows: MatchRow[];
  mode?: 'load' | 'checklist';
}) {
  if (!rows.length) return null;
  const toneFn = mode === 'checklist' ? checklistTone : matchTone;
  const short = rows.filter((r) => {
    const t = toneFn(r);
    return t.className.includes('error') || t.label.startsWith('Faltan');
  }).length;
  const extra = rows.filter((r) => toneFn(r).label.includes('De más') || toneFn(r).label.includes('de más')).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-[11px]">
        {short > 0 && (
          <span className="rounded-md bg-error/10 px-2 py-1 font-semibold text-error">
            {short} producto(s) de menos
          </span>
        )}
        {extra > 0 && (
          <span className="rounded-md bg-amber-500/15 px-2 py-1 font-semibold text-amber-900">
            {extra} producto(s) de más / desvío
          </span>
        )}
        {short === 0 && extra === 0 && (
          <span className="rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">
            {mode === 'checklist' ? 'Checklist completo' : 'Coincide con lo solicitado'}
          </span>
        )}
      </div>
      <ul className="divide-y divide-outline-variant/30 rounded-md border border-outline-variant/40">
        {rows.map((row) => {
          const tone = toneFn(row);
          return (
            <li key={row.catalogId} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-on-surface">{row.name}</p>
                <p className="font-mono text-[11px] text-on-surface-variant">{row.sku || '—'}</p>
              </div>
              <div className="shrink-0 text-right text-xs">
                <p className="text-on-surface-variant">
                  {mode === 'checklist'
                    ? `Esp. ${row.planned} · OK ${row.loaded} · Sol. ${row.requested}`
                    : `Sol. ${row.requested} · Plan ${row.planned} · Carg. ${row.loaded}`}
                </p>
                <p className={`font-semibold ${tone.className}`}>{tone.label}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type BarChartProps = {
  title: string;
  labels: string[];
  values: number[];
  emptyLabel?: string;
};

const LABEL_MAP: Record<string, string> = {
  en_stock: 'En stock',
  en_transito: 'En tránsito',
  en_uso: 'En uso',
  dado_de_baja: 'Baja',
  draft: 'Borrador',
  submitted: 'Enviada',
  quotation: 'Cotización',
  quotation_accepted: 'Aceptada',
  fulfillment: 'Asignación',
  in_field: 'Campo',
  returning: 'Retorno',
  validated: 'Validada',
  completed: 'Completada',
};

function pretty(label: string) {
  return LABEL_MAP[label] ?? label;
}

/** Compact horizontal bar chart — no chart library dependency. */
export function SimpleBarChart({ title, labels, values, emptyLabel = 'Sin datos aún' }: BarChartProps) {
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <section className="panoptes-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-on-surface">
          {title}
        </h3>
        <span className="text-xs text-on-surface-variant">Total {total}</span>
      </div>
      {!total ? (
        <p className="py-6 text-center text-sm text-on-surface-variant">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2.5">
          {labels.map((label, index) => {
            const value = values[index] ?? 0;
            const pct = Math.round((value / max) * 100);
            return (
              <li key={label}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="font-medium text-on-surface">{pretty(label)}</span>
                  <span className="tabular-nums text-on-surface-variant">{value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

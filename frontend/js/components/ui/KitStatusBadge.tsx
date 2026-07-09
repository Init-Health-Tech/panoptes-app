import { SUPPLY_KIT_STATUS_LABELS } from '@/js/types/medical';

const STATUS_STYLES: Record<string, string> = {
  armando: 'bg-surface-container-high text-on-surface-variant',
  lista: 'bg-secondary-container/60 text-primary',
  en_transito: 'bg-blue-100 text-blue-800',
  entregada: 'bg-tertiary-container/30 text-tertiary',
  usada: 'bg-surface-container text-on-surface-variant',
  scheduled: 'bg-secondary-container/40 text-primary',
  in_preparation: 'bg-warning/20 text-amber-800',
  in_transit: 'bg-blue-100 text-blue-800',
  completed: 'bg-surface-container text-on-surface-variant',
  cancelled: 'bg-error-container/50 text-error',
};

type KitStatusBadgeProps = {
  status: string;
  labels?: Record<string, string>;
};

export function KitStatusBadge({ status, labels = SUPPLY_KIT_STATUS_LABELS }: KitStatusBadgeProps) {
  const label = labels[status] ?? status;
  const style = STATUS_STYLES[status] ?? 'bg-surface-container text-on-surface';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

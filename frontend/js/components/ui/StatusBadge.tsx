import type { RfidTagStatus } from '@/js/types/modules';
import { RFID_STATUS_LABELS } from '@/js/types/modules';

const STATUS_STYLES: Record<RfidTagStatus, string> = {
  en_stock: 'bg-secondary-container/60 text-primary',
  en_transito: 'bg-blue-100 text-blue-800',
  en_uso: 'bg-tertiary-container/30 text-tertiary',
  dado_de_baja: 'bg-surface-container-high text-on-surface-variant',
};

type StatusBadgeProps = {
  status: RfidTagStatus | string;
  pulse?: boolean;
};

export function StatusBadge({ status, pulse = false }: StatusBadgeProps) {
  const label = RFID_STATUS_LABELS[status as RfidTagStatus] ?? status;
  const style = STATUS_STYLES[status as RfidTagStatus] ?? 'bg-surface-container text-on-surface';

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        style,
        pulse ? 'status-pulse' : '',
      ].join(' ')}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

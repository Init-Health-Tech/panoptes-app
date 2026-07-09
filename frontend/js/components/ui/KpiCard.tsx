import type { ReactNode } from 'react';

type KpiCardProps = {
  label: string;
  value: string | number;
  icon: string;
  accent?: 'primary' | 'tertiary' | 'warning';
  footer?: ReactNode;
};

const ACCENT_STYLES = {
  primary: 'bg-secondary-container/40 text-primary',
  tertiary: 'bg-tertiary-container/30 text-tertiary',
  warning: 'bg-warning/20 text-amber-800',
};

export function KpiCard({ label, value, icon, accent = 'primary', footer }: KpiCardProps) {
  return (
    <div className="panoptes-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            {label}
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-on-surface">
            {value}
          </p>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${ACCENT_STYLES[accent]}`}
        >
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
      {footer && <div className="mt-3 border-t border-outline-variant/20 pt-3">{footer}</div>}
    </div>
  );
}

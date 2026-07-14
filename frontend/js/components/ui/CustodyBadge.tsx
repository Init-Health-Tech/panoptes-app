type CustodyBadgeProps = {
  isAvailable?: boolean | string | null;
  custodyLabel?: string | null;
  custodyType?: string | null;
  className?: string;
};

function asAvailable(value: boolean | string | null | undefined): boolean | null {
  if (value === true || value === 'true' || value === 'True') return true;
  if (value === false || value === 'false' || value === 'False') return false;
  return null;
}

/** Atom: shows if an RFID tag is free or already in custody. */
export function CustodyBadge({
  isAvailable,
  custodyLabel,
  custodyType,
  className = '',
}: CustodyBadgeProps) {
  const available = asAvailable(isAvailable);
  if (available === false) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ${className}`}
        title={custodyLabel ?? undefined}
      >
        <span className="material-symbols-outlined text-sm">lock</span>
        Ocupado
        {custodyType === 'supply_kit' ? ' · carga' : custodyType === 'material_dispatch' ? ' · despacho' : ''}
      </span>
    );
  }
  if (available) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-secondary-container/60 px-2 py-0.5 text-[11px] font-semibold text-primary ${className}`}
      >
        <span className="material-symbols-outlined text-sm">lock_open</span>
        Libre
      </span>
    );
  }
  return null;
}

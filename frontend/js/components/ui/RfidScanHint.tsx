type RfidScanHintProps = {
  label: string;
  className?: string;
};

/** Visual cue that products can be loaded/confirmed via RFID at this step. */
export function RfidScanHint({ label, className = '' }: RfidScanHintProps) {
  return (
    <div
      className={`inline-flex w-full items-center gap-2 rounded-md border border-dashed border-outline-variant/60 bg-surface-container/60 px-3 py-2 text-xs text-on-surface-variant ${className}`}
      role="note"
    >
      <span aria-hidden className="material-symbols-outlined text-base text-primary">
        sensors
      </span>
      <span>{label}</span>
    </div>
  );
}

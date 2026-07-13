import type { ButtonHTMLAttributes } from 'react';

type DocumentPlaceholderButtonProps = {
  label?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** Disabled placeholder for future document generation at each validation step. */
export function DocumentPlaceholderButton({
  label = 'Crear documentos para este proceso (próximamente)',
  className = '',
  ...props
}: DocumentPlaceholderButtonProps) {
  return (
    <button
      className={`inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-outline-variant/50 bg-surface-container px-3 py-2 text-xs font-medium text-on-surface-variant opacity-70 ${className}`}
      disabled
      type="button"
      {...props}
    >
      <span className="material-symbols-outlined text-base">description</span>
      {label}
    </button>
  );
}

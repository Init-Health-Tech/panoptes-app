export type ProcessStepStatus = 'completed' | 'current' | 'upcoming' | 'blocked';

export type ProcessStep = {
  id: string;
  label: string;
  description?: string;
  status: ProcessStepStatus;
  roles?: string[];
};

type ProcessStepperProps = {
  steps: ProcessStep[];
  className?: string;
  /** Ultra-compact single-line flow for desktop rows (fits a normal screen). */
  dense?: boolean;
};

const DOT_STYLES: Record<ProcessStepStatus, string> = {
  completed: 'border-primary bg-primary text-on-primary',
  current: 'border-primary bg-secondary-container text-primary ring-2 ring-primary/25',
  upcoming: 'border-outline-variant bg-surface-container text-on-surface-variant',
  blocked: 'border-outline-variant/50 bg-surface-container text-on-surface-variant opacity-45',
};

const LABEL_STYLES: Record<ProcessStepStatus, string> = {
  completed: 'text-on-surface',
  current: 'text-primary',
  upcoming: 'text-on-surface-variant',
  blocked: 'text-on-surface-variant opacity-45',
};

/** Vertical on phones; horizontal on desktop. `dense` = one-line PC row. */
export function ProcessStepper({ steps, className = '', dense = false }: ProcessStepperProps) {
  if (dense) {
    return (
      <ol className={`flex w-full min-w-0 items-center ${className}`} aria-label="Progreso del flujo">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const showLabel = step.status === 'current' || steps.length <= 5;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center">
              <div className="flex min-w-0 flex-col items-center px-0.5 text-center">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${DOT_STYLES[step.status]}`}
                  title={step.label}
                >
                  {step.status === 'completed' ? (
                    <span className="material-symbols-outlined text-[11px]">check</span>
                  ) : (
                    index + 1
                  )}
                </span>
                {showLabel && (
                  <p
                    className={`mt-0.5 max-w-[4.5rem] truncate text-[9px] font-semibold leading-tight ${LABEL_STYLES[step.status]}`}
                  >
                    {step.label}
                  </p>
                )}
              </div>
              {!isLast && (
                <span
                  aria-hidden
                  className={`mx-0.5 h-px min-w-2 flex-1 ${
                    step.status === 'completed' ? 'bg-primary/45' : 'bg-outline-variant/45'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <>
      <ol className={`flex flex-col lg:hidden ${className}`}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li key={`v-${step.id}`} className="flex gap-2.5">
              <div className="flex w-5 shrink-0 flex-col items-center">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold leading-none ${DOT_STYLES[step.status]}`}
                >
                  {step.status === 'completed' ? (
                    <span className="material-symbols-outlined text-[12px]">check</span>
                  ) : (
                    index + 1
                  )}
                </span>
                {!isLast && (
                  <span
                    aria-hidden
                    className={`my-0.5 w-px flex-1 min-h-[10px] ${
                      step.status === 'completed' ? 'bg-primary/50' : 'bg-outline-variant/50'
                    }`}
                  />
                )}
              </div>
              <div className={`min-w-0 pb-2 ${isLast ? 'pb-0' : ''}`}>
                <p className={`text-xs font-semibold leading-5 ${LABEL_STYLES[step.status]}`}>
                  {step.label}
                  {step.status === 'current' && (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                      ahora
                    </span>
                  )}
                </p>
                {step.status === 'current' && step.description && (
                  <p className="text-[11px] leading-snug text-on-surface-variant">{step.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <ol className={`hidden w-full items-start lg:flex ${className}`}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li key={`h-${step.id}`} className="flex min-w-0 flex-1 items-start">
              <div className="flex w-full min-w-0 flex-col items-center px-1 text-center">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${DOT_STYLES[step.status]}`}
                >
                  {step.status === 'completed' ? (
                    <span className="material-symbols-outlined text-[13px]">check</span>
                  ) : (
                    index + 1
                  )}
                </span>
                <p
                  className={`mt-1.5 line-clamp-2 text-[10px] font-semibold leading-tight ${LABEL_STYLES[step.status]}`}
                >
                  {step.label}
                </p>
                {step.status === 'current' && (
                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary/80">
                    ahora
                  </span>
                )}
              </div>
              {!isLast && (
                <span
                  aria-hidden
                  className={`mt-3 h-px w-full min-w-2 max-w-8 shrink self-start ${
                    step.status === 'completed' ? 'bg-primary/40' : 'bg-outline-variant/50'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

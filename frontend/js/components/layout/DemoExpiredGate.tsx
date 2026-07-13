import { useEffect, useState } from 'react';

import { demoRequestLicenseRetrieve } from '@/js/api/platformExtras';
import { useOptionalModules } from '@/js/context/ModulesContext';

/** Full-screen gate when a demo account has expired. */
export function DemoExpiredGate({ children }: { children: React.ReactNode }) {
  const modules = useOptionalModules();
  const expired = Boolean(modules?.is_demo_expired);
  const [mailto, setMailto] = useState(
    'mailto:sales@init.com.mx?subject=Solicitud%20versi%C3%B3n%20completa%20Panoptes',
  );

  useEffect(() => {
    if (!expired) return;
    demoRequestLicenseRetrieve()
      .then((res) => setMailto(res.data.mailto))
      .catch(() => undefined);
  }, [expired]);

  if (!expired || modules?.is_platform_admin) return children;

  const orgName = modules?.organization?.name ?? 'tu organización';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <div className="panoptes-card max-w-lg p-6 text-center shadow-[var(--shadow-card)]">
        <span className="material-symbols-outlined text-4xl text-primary">hourglass_disabled</span>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold text-on-surface">
          Demo finalizada
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          La cuenta demo de <strong>{orgName}</strong> ha llegado al final del periodo de prueba.
          Para continuar con la versión completa de Panoptes, escribe a ventas.
        </p>
        <a className="panoptes-btn-primary mt-6 inline-flex w-full justify-center" href={mailto}>
          Solicitar versión completa
        </a>
        <p className="mt-3 text-xs text-on-surface-variant">sales@init.com.mx</p>
      </div>
    </div>
  );
}

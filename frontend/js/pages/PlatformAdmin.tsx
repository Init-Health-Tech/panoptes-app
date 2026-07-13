import { useEffect, useState } from 'react';
import { Link, useLoaderData, useRevalidator } from 'react-router';

import {
  platformExtendDemo,
  platformPackagesList,
  platformOrganizationsList,
  platformProvisionDemo,
  platformPurgeDemo,
  platformUsageSummary,
  type PlatformOrganization,
  type ProductPackage,
} from '@/js/api/platformExtras';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { ConfirmDialog } from '@/js/components/ui/ConfirmDialog';
import { FormField } from '@/js/components/ui/FormField';
import { Input } from '@/js/components/ui/Input';
import { SimpleBarChart } from '@/js/components/ui/SimpleBarChart';
import { useOptionalModules } from '@/js/context/ModulesContext';

type LoaderData = {
  organizations: PlatformOrganization[];
  packages: ProductPackage[];
  usage: Awaited<ReturnType<typeof platformUsageSummary>>['data'] | null;
  forbidden: boolean;
};

const PlatformAdmin = () => {
  const data = useLoaderData<LoaderData>();
  const revalidator = useRevalidator();
  const modules = useOptionalModules();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [days, setDays] = useState('14');
  const [packageCode, setPackageCode] = useState('pkg_instrumental');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<{ email: string; password: string | null } | null>(
    null,
  );
  const [purgeTarget, setPurgeTarget] = useState<PlatformOrganization | null>(null);

  useEffect(() => {
    if (data.packages[0] && !data.packages.find((p) => p.code === packageCode)) {
      setPackageCode(data.packages[0].code);
    }
  }, [data.packages, packageCode]);

  if (data.forbidden) {
    return (
      <AppLayout subtitle="Solo operadores INIT" title="Platform admin">
        <div className="panoptes-card p-6 text-sm text-on-surface-variant">
          No tienes permisos de plataforma. Entra con una cuenta superuser INIT (p. ej.{' '}
          <code className="font-mono">demo@init.health</code>).
          <div className="mt-4">
            <Link className="panoptes-btn-secondary" to="/">
              Volver al dashboard
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const createDemo = async () => {
    setBusy(true);
    setError('');
    setCredentials(null);
    try {
      const response = await platformProvisionDemo({
        name,
        contact_email: email,
        contact_name: contactName,
        duration_days: Number(days) || 14,
        package_codes: [packageCode],
        industry_type: 'clinical',
      });
      const creds = response.data.demo_credentials;
      if (creds) setCredentials({ email: creds.email, password: creds.password });
      setName('');
      setEmail('');
      setContactName('');
      revalidator.revalidate();
    } catch {
      setError('No se pudo crear la demo. Revisa el email y que seas superuser.');
    } finally {
      setBusy(false);
    }
  };

  const confirmPurge = async () => {
    if (!purgeTarget) return;
    setBusy(true);
    try {
      await platformPurgeDemo(purgeTarget.id);
      setPurgeTarget(null);
      revalidator.revalidate();
    } catch {
      setError('No se pudo purgar la demo.');
    } finally {
      setBusy(false);
    }
  };

  const usageByOrg = data.usage?.by_organization ?? [];
  const usageByModule = data.usage?.by_module ?? [];

  return (
    <AppLayout
      subtitle={`Operador: ${modules?.organization?.name ?? 'INIT'} · clientes, demos y telemetría`}
      title="Platform admin"
      actions={
        <Link className="panoptes-btn-secondary text-sm" to="/">
          Dashboard cliente
        </Link>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="panoptes-card p-4">
          <p className="text-xs font-semibold uppercase text-on-surface-variant">Clientes / orgs</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
            {data.organizations.length}
          </p>
        </div>
        <div className="panoptes-card p-4">
          <p className="text-xs font-semibold uppercase text-on-surface-variant">Demos activas</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
            {data.usage?.demo_count ?? data.organizations.filter((o) => o.account_type === 'demo').length}
          </p>
        </div>
        <div className="panoptes-card p-4">
          <p className="text-xs font-semibold uppercase text-on-surface-variant">Demos por vencer (3d)</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-amber-800">
            {data.usage?.demos_expiring_soon ?? 0}
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <SimpleBarChart
          labels={usageByOrg.map((r) => r.organization__name)}
          title="Requests por cliente (7 días)"
          values={usageByOrg.map((r) => r.requests)}
          emptyLabel="Aún no hay telemetría. Navega con usuarios de cliente."
        />
        <SimpleBarChart
          labels={usageByModule.map((r) => r.module_code)}
          title="Uso por módulo (7 días)"
          values={usageByModule.map((r) => r.requests)}
          emptyLabel="Sin eventos de módulo todavía."
        />
      </div>

      <section className="panoptes-card mb-8 space-y-3 p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Crear cuenta demo
        </h2>
        <p className="text-sm text-on-surface-variant">
          Genera org + usuario (sin acceso a Django admin), asigna un producto y define la duración.
          Al vencer, el cliente verá CTA a sales@init.com.mx.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField htmlFor="demo-name" label="Nombre del cliente">
            <Input id="demo-name" onChange={(e) => setName(e.target.value)} required value={name} />
          </FormField>
          <FormField htmlFor="demo-email" label="Correo demo">
            <Input
              id="demo-email"
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              value={email}
            />
          </FormField>
          <FormField htmlFor="demo-contact" label="Contacto">
            <Input
              id="demo-contact"
              onChange={(e) => setContactName(e.target.value)}
              value={contactName}
            />
          </FormField>
          <FormField htmlFor="demo-days" label="Duración (días)">
            <Input
              id="demo-days"
              min={1}
              onChange={(e) => setDays(e.target.value)}
              type="number"
              value={days}
            />
          </FormField>
          <FormField htmlFor="demo-pkg" label="Producto / package">
            <select
              className="panoptes-input"
              id="demo-pkg"
              onChange={(e) => setPackageCode(e.target.value)}
              value={packageCode}
            >
              {data.packages.map((pkg) => (
                <option key={pkg.code} value={pkg.code}>
                  {pkg.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
        {credentials && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="font-semibold text-on-surface">Credenciales generadas (guárdalas ahora)</p>
            <p className="mt-1 font-mono text-xs">
              {credentials.email}
              {credentials.password ? ` / ${credentials.password}` : ' (usuario ya existía; password no regenerada)'}
            </p>
          </div>
        )}
        <button
          className="panoptes-btn-primary"
          disabled={busy || !name.trim() || !email.trim()}
          onClick={createDemo}
          type="button"
        >
          {busy ? 'Creando…' : 'Crear demo'}
        </button>
      </section>

      <section className="space-y-3" data-tour="platform-org-list">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Organizaciones
        </h2>
        <ul className="space-y-3">
          {data.organizations.map((org) => (
            <li key={org.id} className="panoptes-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface">{org.name}</p>
                  <p className="font-mono text-xs text-on-surface-variant">
                    {org.slug} · {org.account_type}
                    {org.demo_expires_at
                      ? ` · expira ${new Date(org.demo_expires_at).toLocaleDateString('es-MX')}`
                      : ''}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Módulos: {org.active_modules.join(', ') || '—'} · Packages:{' '}
                    {org.packages.join(', ') || '—'} · {org.member_count} usuarios
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {org.account_type === 'demo' && (
                    <>
                      <button
                        className="panoptes-btn-secondary text-xs"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await platformExtendDemo(org.id, 7);
                            revalidator.revalidate();
                          } finally {
                            setBusy(false);
                          }
                        }}
                        type="button"
                      >
                        +7 días
                      </button>
                      <button
                        className="panoptes-btn-secondary text-xs text-error"
                        disabled={busy}
                        onClick={() => setPurgeTarget(org)}
                        type="button"
                      >
                        Purgar demo
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        busy={busy}
        confirmLabel="Purgar datos"
        danger
        message={
          purgeTarget
            ? `Se borrarán inventarios, instrumental, medical y logística de «${purgeTarget.name}». La org se desactivará. No afecta otras orgs.`
            : ''
        }
        onCancel={() => setPurgeTarget(null)}
        onConfirm={confirmPurge}
        open={Boolean(purgeTarget)}
        title="Purgar demo"
      />
    </AppLayout>
  );
};

export default PlatformAdmin;

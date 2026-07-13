import { Link, useLoaderData } from 'react-router';

import type { DashboardCharts } from '@/js/api/platformExtras';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { KpiCard } from '@/js/components/ui/KpiCard';
import { PanoptesLogo } from '@/js/components/ui/PanoptesLogo';
import { SimpleBarChart } from '@/js/components/ui/SimpleBarChart';
import { hasInstrumentalProduct } from '@/js/config/modules';
import { useOptionalModules } from '@/js/context/ModulesContext';

type DashboardLoaderData = {
  stats: {
    active_tags: number;
    tags_in_stock: number;
    tags_in_transit: number;
    tags_in_use: number;
  } | null;
  medicalStats: {
    kits_in_transit: number;
    kits_assembling: number;
    active_procedures: number;
  } | null;
  logisticsStats: {
    pending_requisitions: number;
    requisitions_in_transit: number;
    open_sales_orders: number;
    open_purchase_orders: number;
  } | null;
  instrumentalStats: {
    open_requests: number;
    pending_quotations: number;
    active_fulfillments: number;
    materials_in_field: number;
    materials_returning: number;
  } | null;
  charts: DashboardCharts | null;
};

const Dashboard = () => {
  const { stats, medicalStats, logisticsStats, instrumentalStats, charts } =
    useLoaderData<DashboardLoaderData>();
  const modules = useOptionalModules();
  const hasInventory = modules?.modules.includes('inventory_realtime');
  const hasLogistics = modules?.modules.includes('logistics_requisitions');
  const hasInstrumental = hasInstrumentalProduct(modules?.modules ?? []);
  const showInstrumentalKpis = hasInstrumental && (medicalStats || instrumentalStats);
  const demoExpiry = modules?.demo_expires_at ? new Date(modules.demo_expires_at) : null;
  const daysLeft =
    demoExpiry && modules?.account_type === 'demo'
      ? Math.ceil((demoExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

  return (
    <AppLayout
      subtitle={
        modules?.organization
          ? `Organización: ${modules.organization.name}`
          : 'Sin organización asignada'
      }
      title="Dashboard"
      tourId="system"
    >
      {!modules?.organization && (
        <div className="panoptes-card mb-6 border-warning/40 bg-warning/10 p-4 text-sm text-amber-900">
          Tu usuario no tiene una organización asignada. Contacta al administrador.
        </div>
      )}

      {modules?.account_type === 'demo' && daysLeft != null && daysLeft > 0 && daysLeft <= 7 && (
        <div className="panoptes-card mb-6 border-warning/40 bg-warning/10 p-4 text-sm text-amber-900">
          Tu demo vence en <strong>{daysLeft} día(s)</strong>
          {demoExpiry ? ` (${demoExpiry.toLocaleDateString('es-MX')})` : ''}. Para la versión
          completa escribe a{' '}
          <a className="font-semibold underline" href="mailto:sales@init.com.mx">
            sales@init.com.mx
          </a>
          .
        </div>
      )}

      {modules?.is_platform_admin && (
        <div className="mb-6">
          <Link className="panoptes-btn-secondary text-sm" to="/platform">
            <span className="material-symbols-outlined text-base">admin_panel_settings</span>
            Abrir Platform admin (clientes / demos)
          </Link>
        </div>
      )}

      {hasInventory && stats && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-on-surface">
              Inventario RFID
            </h2>
            <Link className="panoptes-btn-secondary text-xs" to="/inventory">
              Ver inventario
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard accent="primary" icon="sensors" label="Tags activos" value={stats.active_tags} />
            <KpiCard accent="primary" icon="inventory_2" label="En stock" value={stats.tags_in_stock} />
            <KpiCard accent="tertiary" icon="local_shipping" label="En tránsito" value={stats.tags_in_transit} />
            <KpiCard accent="warning" icon="medical_services" label="En uso" value={stats.tags_in_use} />
          </div>
          {charts?.inventory && (
            <div className="mt-4 max-w-md">
              <SimpleBarChart
                labels={charts.inventory.labels}
                title="Distribución por estado"
                values={charts.inventory.values}
              />
            </div>
          )}
        </section>
      )}

      {showInstrumentalKpis && (
        <section className="mb-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-on-surface">
              Control de instrumental
            </h2>
            <div className="flex flex-wrap gap-2">
              <Link className="panoptes-btn-secondary text-xs" to="/instrumental">
                Ver flujo
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
              <Link className="panoptes-btn-secondary text-xs" to="/supply-kits">
                Ver cargas
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {instrumentalStats && (
              <>
                <KpiCard
                  accent="warning"
                  icon="pending_actions"
                  label="Solicitudes abiertas"
                  value={instrumentalStats.open_requests}
                />
                <KpiCard
                  accent="primary"
                  icon="request_quote"
                  label="Cotiz. pendientes"
                  value={instrumentalStats.pending_quotations}
                />
                <KpiCard
                  accent="tertiary"
                  icon="deployed_code"
                  label="Despachos activos"
                  value={instrumentalStats.active_fulfillments}
                />
                <KpiCard
                  accent="warning"
                  icon="apartment"
                  label="En hospital"
                  value={instrumentalStats.materials_in_field}
                />
              </>
            )}
            {medicalStats && (
              <>
                <KpiCard
                  accent="tertiary"
                  icon="local_shipping"
                  label="Cargas en tránsito"
                  value={medicalStats.kits_in_transit}
                />
                <KpiCard
                  accent="primary"
                  icon="medical_services"
                  label="Cargas armando"
                  value={medicalStats.kits_assembling}
                />
                <KpiCard
                  accent="warning"
                  icon="clinical_notes"
                  label="Procedimientos activos"
                  value={medicalStats.active_procedures}
                />
              </>
            )}
          </div>
          {charts?.instrumental_funnel && (charts.instrumental_funnel.total ?? 0) > 0 && (
            <div className="mt-4 max-w-lg">
              <SimpleBarChart
                labels={charts.instrumental_funnel.labels}
                title="Embudo de solicitudes instrumental"
                values={charts.instrumental_funnel.values}
              />
            </div>
          )}
        </section>
      )}

      {hasLogistics && logisticsStats && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-on-surface">
              Logística
            </h2>
            <Link className="panoptes-btn-secondary text-xs" to="/requisitions">
              Ver requisiciones
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              accent="warning"
              icon="pending_actions"
              label="Requisiciones pendientes"
              value={logisticsStats.pending_requisitions}
            />
            <KpiCard
              accent="tertiary"
              icon="local_shipping"
              label="En tránsito"
              value={logisticsStats.requisitions_in_transit}
            />
            <KpiCard
              accent="primary"
              icon="receipt_long"
              label="Ventas abiertas"
              value={logisticsStats.open_sales_orders}
            />
            <KpiCard
              accent="primary"
              icon="shopping_cart"
              label="Compras abiertas"
              value={logisticsStats.open_purchase_orders}
            />
          </div>
        </section>
      )}

      <section className="panoptes-card p-6">
        <div className="flex items-start gap-4">
          <PanoptesLogo className="shrink-0" size={48} />
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Panoptes RFID
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
              Control en tiempo real de instrumental y logística. Los módulos visibles en el sidebar se
              ajustan según la configuración de tu organización.
            </p>
            <p className="mt-3 text-xs text-on-surface-variant">
              Módulos activos: {modules?.modules.length ? modules.modules.join(', ') : 'ninguno'}
            </p>
          </div>
        </div>
      </section>
    </AppLayout>
  );
};

export default Dashboard;

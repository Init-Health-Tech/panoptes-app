import { Link, useLoaderData } from 'react-router';

import { AppLayout } from '@/js/components/layout/AppLayout';
import { KpiCard } from '@/js/components/ui/KpiCard';
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
};

const Dashboard = () => {
  const { stats, medicalStats, logisticsStats } = useLoaderData<DashboardLoaderData>();
  const modules = useOptionalModules();
  const hasInventory = modules?.modules.includes('inventory_realtime');
  const hasMedicalKits = modules?.modules.includes('medical_kits');
  const hasLogistics = modules?.modules.includes('logistics_requisitions');

  return (
    <AppLayout
      subtitle={
        modules?.organization
          ? `Organización: ${modules.organization.name}`
          : 'Sin organización asignada'
      }
      title="Dashboard"
    >
      {!modules?.organization && (
        <div className="panoptes-card mb-6 border-warning/40 bg-warning/10 p-4 text-sm text-amber-900">
          Tu usuario no tiene una organización asignada. Contacta al administrador.
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
        </section>
      )}

      {hasMedicalKits && medicalStats && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-on-surface">
              Módulo médico
            </h2>
            <Link className="panoptes-btn-secondary text-xs" to="/supply-kits">
              Ver maletas
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard accent="tertiary" icon="local_shipping" label="Maletas en tránsito" value={medicalStats.kits_in_transit} />
            <KpiCard accent="primary" icon="medical_services" label="Armando" value={medicalStats.kits_assembling} />
            <KpiCard accent="warning" icon="clinical_notes" label="Procedimientos activos" value={medicalStats.active_procedures} />
          </div>
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
            <KpiCard accent="warning" icon="pending_actions" label="Requisiciones pendientes" value={logisticsStats.pending_requisitions} />
            <KpiCard accent="tertiary" icon="local_shipping" label="En tránsito" value={logisticsStats.requisitions_in_transit} />
            <KpiCard accent="primary" icon="receipt_long" label="Ventas abiertas" value={logisticsStats.open_sales_orders} />
            <KpiCard accent="primary" icon="shopping_cart" label="Compras abiertas" value={logisticsStats.open_purchase_orders} />
          </div>
        </section>
      )}

      <section className="panoptes-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container/50 text-primary">
            <span className="material-symbols-outlined filled status-pulse">radar</span>
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Panoptes RFID
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
              Control en tiempo real de insumos y logística. Los módulos visibles en el sidebar se
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

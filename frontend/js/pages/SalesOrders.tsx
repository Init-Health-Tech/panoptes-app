import { Link, useLoaderData } from 'react-router';

import type { PaginatedSalesOrderList } from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';
import { ORDER_STATUS_LABELS } from '@/js/types/logistics';
import { makeLink } from '@/js/utils';

const SalesOrders = () => {
  const data = useLoaderData<PaginatedSalesOrderList>();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);

  return (
    <AppLayout subtitle="Órdenes de venta a clientes" title="Ventas">
      <div className="panoptes-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="panoptes-table-header">Orden</th>
              <th className="panoptes-table-header">Cliente</th>
              <th className="panoptes-table-header">Estado</th>
              <th className="panoptes-table-header">Total</th>
              <th className="panoptes-table-header">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {data.results?.length ? (
              data.results.map((order) => (
                <tr key={order.id} className="panoptes-table-row">
                  <td className="px-4 py-3 font-mono">SO-{order.id}</td>
                  <td className="px-4 py-3">{order.client_name}</td>
                  <td className="px-4 py-3">
                    <KitStatusBadge labels={ORDER_STATUS_LABELS} status={order.status ?? 'borrador'} />
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    ${Number(order.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {order.ordered_at ? new Date(order.ordered_at).toLocaleDateString('es-MX') : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={5}>
                  No hay órdenes de venta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} órdenes</span>
        <div className="flex gap-2">
          {prev && <Link className="panoptes-btn-primary" to={prev}>← Anterior</Link>}
          {next && <Link className="panoptes-btn-primary" to={next}>Siguiente →</Link>}
        </div>
      </div>
    </AppLayout>
  );
};

export default SalesOrders;

import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  salesOrdersCreate,
  salesOrdersPartialUpdate,
  type Client,
  type PaginatedSalesOrderList,
  type Product,
  type SalesOrder,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { Select } from '@/js/components/ui/Select';
import { KitStatusBadge } from '@/js/components/ui/KitStatusBadge';
import { ORDER_STATUS_LABELS } from '@/js/types/logistics';
import { makeLink } from '@/js/utils';

type SalesOrdersLoaderData = PaginatedSalesOrderList & {
  clients: Client[];
  products: Product[];
};

function SalesOrderStatusEdit({ order, onSaved }: { order: SalesOrder; onSaved: () => void }) {
  const [status, setStatus] = useState(order.status ?? 'borrador');

  const handleUpdate = async () => {
    await salesOrdersPartialUpdate({
      path: { id: order.id },
      body: { status },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title={`SO-${order.id}`}>
      <FormField htmlFor={`so-status-${order.id}`} label="Estado">
        <Select
          id={`so-status-${order.id}`}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          value={status}
        >
          {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>
    </EditFormPanel>
  );
}

const SalesOrders = () => {
  const data = useLoaderData<SalesOrdersLoaderData>();
  const revalidator = useRevalidator();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [clientId, setClientId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');

  const refresh = () => revalidator.revalidate();

  const handleCreate = async () => {
    await salesOrdersCreate({
      body: {
        client: Number(clientId),
        status: 'borrador',
        lines: [
          {
            product: Number(productId),
            quantity: Number(quantity),
            unit_price: unitPrice,
          },
        ],
      },
      throwOnError: true,
    });
    setClientId('');
    setProductId('');
    setQuantity('1');
    setUnitPrice('0');
    refresh();
  };

  return (
    <AppLayout subtitle="Órdenes de venta a clientes" title="Ventas">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Crear orden" title="Nueva orden de venta">
        <FormField htmlFor="so-client" label="Cliente">
          <Select id="so-client" onChange={(e) => setClientId(e.target.value)} required value={clientId}>
            <option value="">Seleccionar…</option>
            {data.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.business_name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="so-product" label="Producto">
          <Select id="so-product" onChange={(e) => setProductId(e.target.value)} required value={productId}>
            <option value="">Seleccionar…</option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} — {product.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="so-qty" label="Cantidad">
          <Input
            id="so-qty"
            min={1}
            onChange={(e) => setQuantity(e.target.value)}
            required
            type="number"
            value={quantity}
          />
        </FormField>
        <FormField htmlFor="so-price" label="Precio unitario">
          <Input
            id="so-price"
            min={0}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
            step="0.01"
            type="number"
            value={unitPrice}
          />
        </FormField>
      </FormPanel>

      <div className="panoptes-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="panoptes-table-header">Orden</th>
              <th className="panoptes-table-header">Cliente</th>
              <th className="panoptes-table-header">Estado</th>
              <th className="panoptes-table-header">Total</th>
              <th className="panoptes-table-header">Fecha</th>
              <th className="panoptes-table-header" />
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
                  <td className="px-4 py-3">
                    <SalesOrderStatusEdit order={order} onSaved={refresh} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={6}>
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

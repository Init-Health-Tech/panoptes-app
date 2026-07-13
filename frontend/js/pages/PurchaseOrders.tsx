import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  purchaseOrdersCreate,
  purchaseOrdersPartialUpdate,
  type PaginatedPurchaseOrderList,
  type Product,
  type Provider,
  type PurchaseOrder,
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

type PurchaseOrdersLoaderData = PaginatedPurchaseOrderList & {
  providers: Provider[];
  products: Product[];
};

function PurchaseOrderStatusEdit({ order, onSaved }: { order: PurchaseOrder; onSaved: () => void }) {
  const [status, setStatus] = useState(order.status ?? 'borrador');

  const handleUpdate = async () => {
    await purchaseOrdersPartialUpdate({
      path: { id: order.id },
      body: { status },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title={`PO-${order.id}`}>
      <FormField htmlFor={`po-status-${order.id}`} label="Estado">
        <Select
          id={`po-status-${order.id}`}
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

const PurchaseOrders = () => {
  const data = useLoaderData<PurchaseOrdersLoaderData>();
  const revalidator = useRevalidator();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [providerId, setProviderId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');

  const refresh = () => revalidator.revalidate();

  const handleCreate = async () => {
    await purchaseOrdersCreate({
      body: {
        provider: Number(providerId),
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
    setProviderId('');
    setProductId('');
    setQuantity('1');
    setUnitPrice('0');
    refresh();
  };

  return (
    <AppLayout subtitle="Órdenes de compra a proveedores" title="Compras">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Crear orden" title="Nueva orden de compra">
        <FormField htmlFor="po-provider" label="Proveedor">
          <Select id="po-provider" onChange={(e) => setProviderId(e.target.value)} required value={providerId}>
            <option value="">Seleccionar…</option>
            {data.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.business_name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="po-product" label="Producto">
          <Select id="po-product" onChange={(e) => setProductId(e.target.value)} required value={productId}>
            <option value="">Seleccionar…</option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} — {product.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="po-qty" label="Cantidad">
          <Input
            id="po-qty"
            min={1}
            onChange={(e) => setQuantity(e.target.value)}
            required
            type="number"
            value={quantity}
          />
        </FormField>
        <FormField htmlFor="po-price" label="Precio unitario">
          <Input
            id="po-price"
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
              <th className="panoptes-table-header">Proveedor</th>
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
                  <td className="px-4 py-3 font-mono">PO-{order.id}</td>
                  <td className="px-4 py-3">{order.provider_name}</td>
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
                    <PurchaseOrderStatusEdit order={order} onSaved={refresh} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={6}>
                  No hay órdenes de compra.
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

export default PurchaseOrders;

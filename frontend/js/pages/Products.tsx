import { Link, useLoaderData, useRevalidator } from 'react-router';
import { useState } from 'react';

import {
  productsCreate,
  productsPartialUpdate,
  type PaginatedProductList,
  type Product,
} from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { EditFormPanel } from '@/js/components/ui/EditFormPanel';
import { FormField } from '@/js/components/ui/FormField';
import { FormPanel } from '@/js/components/ui/FormPanel';
import { Input } from '@/js/components/ui/Input';
import { makeLink } from '@/js/utils';

function ProductRow({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [sku, setSku] = useState(product.sku);
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category ?? '');
  const [unit, setUnit] = useState(product.unit ?? 'pza');

  const handleUpdate = async () => {
    await productsPartialUpdate({
      path: { id: product.id },
      body: { sku, name, category, unit },
      throwOnError: true,
    });
    onSaved();
  };

  return (
    <tr className="panoptes-table-row">
      <td className="px-4 py-3 font-mono font-medium">{product.sku}</td>
      <td className="px-4 py-3">{product.name}</td>
      <td className="px-4 py-3 text-on-surface-variant">{product.category || '—'}</td>
      <td className="px-4 py-3 text-on-surface-variant">{product.unit}</td>
      <td className="px-4 py-3">
        <EditFormPanel onSubmit={handleUpdate} onSuccess={onSaved} title="Editar producto">
          <FormField htmlFor={`sku-${product.id}`} label="SKU">
            <Input id={`sku-${product.id}`} onChange={(e) => setSku(e.target.value)} required value={sku} />
          </FormField>
          <FormField htmlFor={`name-${product.id}`} label="Nombre">
            <Input id={`name-${product.id}`} onChange={(e) => setName(e.target.value)} required value={name} />
          </FormField>
          <FormField htmlFor={`cat-${product.id}`} label="Categoría">
            <Input id={`cat-${product.id}`} onChange={(e) => setCategory(e.target.value)} value={category} />
          </FormField>
          <FormField htmlFor={`unit-${product.id}`} label="Unidad">
            <Input id={`unit-${product.id}`} onChange={(e) => setUnit(e.target.value)} value={unit} />
          </FormField>
        </EditFormPanel>
      </td>
    </tr>
  );
}

const Products = () => {
  const data = useLoaderData<PaginatedProductList>();
  const revalidator = useRevalidator();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('pza');

  const refresh = () => revalidator.revalidate();

  const handleCreate = async () => {
    await productsCreate({ body: { sku, name, category, unit }, throwOnError: true });
    setSku('');
    setName('');
    setCategory('');
    setUnit('pza');
    refresh();
  };

  return (
    <AppLayout subtitle="Catálogo de productos por SKU" title="Productos">
      <FormPanel onSubmit={handleCreate} onSuccess={refresh} submitLabel="Registrar producto" title="Nuevo producto">
        <FormField htmlFor="product-sku" label="SKU">
          <Input id="product-sku" onChange={(e) => setSku(e.target.value)} required value={sku} />
        </FormField>
        <FormField htmlFor="product-name" label="Nombre">
          <Input id="product-name" onChange={(e) => setName(e.target.value)} required value={name} />
        </FormField>
        <FormField htmlFor="product-category" label="Categoría">
          <Input id="product-category" onChange={(e) => setCategory(e.target.value)} value={category} />
        </FormField>
        <FormField htmlFor="product-unit" label="Unidad">
          <Input id="product-unit" onChange={(e) => setUnit(e.target.value)} value={unit} />
        </FormField>
      </FormPanel>

      <div className="panoptes-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="panoptes-table-header">SKU</th>
              <th className="panoptes-table-header">Nombre</th>
              <th className="panoptes-table-header">Categoría</th>
              <th className="panoptes-table-header">Unidad</th>
              <th className="panoptes-table-header w-16"></th>
            </tr>
          </thead>
          <tbody>
            {data.results?.length ? (
              data.results.map((product) => (
                <ProductRow key={product.id} onSaved={refresh} product={product} />
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={5}>
                  No hay productos en el catálogo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-on-surface-variant">{data.count} productos</span>
        <div className="flex gap-2">
          {prev && <Link className="panoptes-btn-primary" to={prev}>← Anterior</Link>}
          {next && <Link className="panoptes-btn-primary" to={next}>Siguiente →</Link>}
        </div>
      </div>
    </AppLayout>
  );
};

export default Products;

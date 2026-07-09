import { Link, useLoaderData } from 'react-router';

import type { PaginatedProductList } from '@/js/api';
import { AppLayout } from '@/js/components/layout/AppLayout';
import { makeLink } from '@/js/utils';

const Products = () => {
  const data = useLoaderData<PaginatedProductList>();
  const prev = makeLink(data.previous);
  const next = makeLink(data.next);

  return (
    <AppLayout subtitle="Catálogo de productos por SKU" title="Productos">
      <div className="panoptes-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="panoptes-table-header">SKU</th>
              <th className="panoptes-table-header">Nombre</th>
              <th className="panoptes-table-header">Categoría</th>
              <th className="panoptes-table-header">Unidad</th>
            </tr>
          </thead>
          <tbody>
            {data.results?.length ? (
              data.results.map((product) => (
                <tr key={product.id} className="panoptes-table-row">
                  <td className="px-4 py-3 font-mono font-medium">{product.sku}</td>
                  <td className="px-4 py-3">{product.name}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{product.category || '—'}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{product.unit}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-on-surface-variant" colSpan={4}>
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

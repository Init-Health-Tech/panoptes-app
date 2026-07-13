import { parse as cookieParse } from 'cookie';

import { client } from '@/js/api/client.gen';

export type BulkImportError = {
  row: number;
  field: string;
  message: string;
};

export type BulkImportResult = {
  created: number;
  skipped: number;
  errors: BulkImportError[];
  created_items?: Array<{ id: number; sku: string; name: string }>;
};

function csrfHeaders(): Record<string, string> {
  const { csrftoken } = cookieParse(document.cookie);
  return csrftoken ? { 'X-CSRFTOKEN': csrftoken } : {};
}

async function downloadTemplate(url: string, filename: string) {
  const response = await client.instance.get(url, {
    responseType: 'blob',
    headers: csrfHeaders(),
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function uploadImport(url: string, file: File): Promise<BulkImportResult> {
  const form = new FormData();
  form.append('file', file);
  const response = await client.instance.post(url, form, {
    headers: csrfHeaders(),
  });
  return response.data as BulkImportResult;
}

export const inventoryImportTemplateDownload = () =>
  downloadTemplate('/api/bulk-import/inventory/template/', 'plantilla_inventario_rfid.xlsx');

export const inventoryImportUpload = (file: File) =>
  uploadImport('/api/bulk-import/inventory/', file);

export const inventoryLocationsImportTemplateDownload = () =>
  downloadTemplate('/api/bulk-import/locations/template/', 'plantilla_ubicaciones.xlsx');

export const inventoryLocationsImportUpload = (file: File) =>
  uploadImport('/api/bulk-import/locations/', file);

export const instrumentCatalogImportTemplateDownload = () =>
  downloadTemplate('/api/bulk-import/catalog/template/', 'plantilla_catalogo_productos.xlsx');

export const instrumentCatalogImportUpload = (file: File) =>
  uploadImport('/api/bulk-import/catalog/', file);

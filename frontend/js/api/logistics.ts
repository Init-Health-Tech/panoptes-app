import { parse as cookieParse } from 'cookie';

import { client } from '@/js/api/client.gen';

export type ScannedProduct = {
  id: number;
  sku: string;
  name: string;
};

export type ScanProductResult = {
  product: ScannedProduct;
  tag_code: string | null;
  matched_by: 'rfid' | 'sku' | null;
};

function csrfHeaders(): Record<string, string> {
  const { csrftoken } = cookieParse(document.cookie);
  return csrftoken ? { 'X-CSRFTOKEN': csrftoken } : {};
}

/**
 * Resuelve un identificador (EPC hex, ASCII de handheld o SKU) al producto de
 * logística correspondiente. Lanza un Error con el mensaje del backend si no
 * encuentra coincidencia (404) o el identificador está vacío (400).
 */
export async function resolveScanProduct(identifier: string): Promise<ScanProductResult> {
  try {
    const response = await client.instance.post(
      '/api/logistics/scan-product/',
      { identifier },
      { headers: csrfHeaders() },
    );
    return response.data as ScanProductResult;
  } catch (error) {
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    throw new Error(detail || 'No se pudo resolver el código escaneado.');
  }
}

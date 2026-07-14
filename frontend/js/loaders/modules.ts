import { AxiosError } from 'axios';
import { redirectDocument } from 'react-router';

import { activeModulesRetrieve } from '@/js/api';
import { getApiBaseUrl } from '@/js/config';
import type { ActiveModules } from '@/js/types/modules';
import { loginRedirectUrl } from '@/js/utils/auth';

function isActiveModules(data: unknown): data is ActiveModules {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return Array.isArray(record.modules);
}

export async function modulesLoader({ request }: { request: Request }): Promise<ActiveModules> {
  try {
    const response = await activeModulesRetrieve({ throwOnError: true });
    if (!isActiveModules(response.data)) {
      const apiBase = getApiBaseUrl();
      throw new Response(
        apiBase
          ? `La API en ${apiBase} no devolvió módulos válidos. Revisa CORS, CSRF y que el backend esté arriba.`
          : 'Falta API_BASE_URL en el build de Vercel. Configúrala (ej. https://api.avant.init.com.mx) y vuelve a desplegar.',
        { status: 502, statusText: 'Bad Gateway' },
      );
    }
    return response.data;
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    if (error instanceof AxiosError && (error.response?.status === 401 || error.response?.status === 403 || error.status === 401 || error.status === 403)) {
      const url = new URL(request.url);
      const next = url.pathname + url.search + url.hash;
      throw redirectDocument(loginRedirectUrl(next));
    }
    if (error instanceof AxiosError && !error.response && !getApiBaseUrl()) {
      throw new Response(
        'Falta API_BASE_URL en Vercel (variable de entorno de build). Sin ella el frontend llama /api en el propio Vercel y falla.',
        { status: 502, statusText: 'Bad Gateway' },
      );
    }
    if (error instanceof AxiosError && !error.response) {
      throw new Response(
        `No se pudo contactar la API (${getApiBaseUrl() || 'same-origin'}). Comprueba que api.avant.init.com.mx esté arriba y que CORS permita este origen (${window.location.origin}).`,
        { status: 502, statusText: 'Bad Gateway' },
      );
    }
    throw error;
  }
}

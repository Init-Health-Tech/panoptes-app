import { client } from '@/js/api/client.gen';
import type { MaterialDispatch } from '@/js/api/types.gen';

/** Unload a material unit from the current cargo (loaded → assigned). */
export async function materialDispatchesUnloadCreate(options: {
  path: { id: number };
  throwOnError?: true;
}) {
  return client.post<MaterialDispatch, { detail?: string }, true>({
    responseType: 'json',
    security: [
      {
        in: 'cookie',
        name: 'sessionid',
        type: 'apiKey',
      },
    ],
    url: '/api/material-dispatches/{id}/unload/',
    throwOnError: true,
    ...options,
  });
}

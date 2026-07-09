import { AxiosError } from 'axios';
import { redirectDocument } from 'react-router';

import { activeModulesRetrieve } from '@/js/api';
import type { ActiveModules } from '@/js/types/modules';
import { loginRedirectUrl } from '@/js/utils/auth';

export async function modulesLoader({ request }: { request: Request }): Promise<ActiveModules> {
  try {
    const response = await activeModulesRetrieve({ throwOnError: true });
    return response.data as ActiveModules;
  } catch (error) {
    if (error instanceof AxiosError && (error?.status === 401 || error?.status === 403)) {
      const url = new URL(request.url);
      const next = url.pathname + url.search + url.hash;
      throw redirectDocument(loginRedirectUrl(next));
    }
    throw error;
  }
}

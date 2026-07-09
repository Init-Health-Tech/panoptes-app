import { AxiosError } from 'axios';
import { redirectDocument } from 'react-router';

import { rfidTagsList } from '@/js/api';
import { loginRedirectUrl } from '@/js/utils/auth';

export async function inventoryLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') || 20);
  const offset = Number(url.searchParams.get('offset') || 0);
  const status = url.searchParams.get('status') || undefined;
  const location = url.searchParams.get('location') || undefined;
  const item_type = url.searchParams.get('item_type') || undefined;

  try {
    const response = await rfidTagsList({
      query: { limit, offset, status, location, item_type },
      throwOnError: true,
    });
    return {
      ...response.data,
      filters: { status: status ?? '', location: location ?? '', item_type: item_type ?? '' },
    };
  } catch (error) {
    if (error instanceof AxiosError && (error?.status === 401 || error?.status === 403)) {
      const next = url.pathname + url.search + url.hash;
      throw redirectDocument(loginRedirectUrl(next));
    }
    throw error;
  }
}

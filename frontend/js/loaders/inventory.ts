import { AxiosError } from 'axios';
import { redirectDocument } from 'react-router';

import { rfidReadEventsList, rfidTagsList, rfidTagsRetrieve } from '@/js/api';
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

export async function inventoryDetailLoader({
  request,
  params,
}: {
  request: Request;
  params: { tagId?: string };
}) {
  const tagId = Number(params.tagId);
  if (!tagId) {
    throw new Response('Not Found', { status: 404 });
  }

  try {
    const [tagResponse, eventsResponse] = await Promise.all([
      rfidTagsRetrieve({ path: { id: tagId }, throwOnError: true }),
      rfidReadEventsList({
        query: { limit: 50, offset: 0, tag: tagId } as { limit?: number; offset?: number },
        throwOnError: true,
      }),
    ]);
    return {
      tag: tagResponse.data,
      events: eventsResponse.data,
    };
  } catch (error) {
    if (error instanceof AxiosError && (error?.status === 401 || error?.status === 403)) {
      const url = new URL(request.url);
      throw redirectDocument(loginRedirectUrl(url.pathname + url.search));
    }
    throw new Response('Not Found', { status: 404 });
  }
}

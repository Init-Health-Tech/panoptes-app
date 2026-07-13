import { AxiosError } from 'axios';
import { redirectDocument } from 'react-router';

import {
  instrumentCatalogList,
  inventoryLocationsList,
  rfidReadEventsList,
  rfidTagsList,
  rfidTagsRetrieve,
} from '@/js/api';
import { loginRedirectUrl } from '@/js/utils/auth';

export async function inventoryLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') || 20);
  const offset = Number(url.searchParams.get('offset') || 0);
  const status = url.searchParams.get('status') || undefined;
  const location = url.searchParams.get('location') || undefined;
  const item_type = url.searchParams.get('item_type') || undefined;

  try {
    const [response, locationsResponse, catalogSettled] = await Promise.all([
      rfidTagsList({
        query: { limit, offset, status, location, item_type },
        throwOnError: true,
      }),
      inventoryLocationsList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
      instrumentCatalogList({ query: { limit: 200, offset: 0 }, throwOnError: false }),
    ]);

    const catalog =
      catalogSettled.data?.results?.filter((item) => item.is_active !== false) ?? [];

    return {
      ...response.data,
      filters: { status: status ?? '', location: location ?? '', item_type: item_type ?? '' },
      catalog,
      locations: (locationsResponse.data.results ?? []).filter((loc) => loc.is_active !== false),
    };
  } catch (error) {
    if (error instanceof AxiosError && (error?.status === 401 || error?.status === 403)) {
      const next = url.pathname + url.search + url.hash;
      throw redirectDocument(loginRedirectUrl(next));
    }
    throw error;
  }
}

export async function inventoryLocationsLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const response = await inventoryLocationsList({
      query: {
        limit: Number(url.searchParams.get('limit') || 50),
        offset: Number(url.searchParams.get('offset') || 0),
      },
      throwOnError: true,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && (error?.status === 401 || error?.status === 403)) {
      throw redirectDocument(loginRedirectUrl(url.pathname + url.search));
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

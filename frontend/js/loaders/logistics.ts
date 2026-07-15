import { AxiosError } from 'axios';

import {
  clientsList,
  inventoryLocationsList,
  logisticsDashboardStatsRetrieve,
  productsList,
  providersList,
  purchaseOrdersList,
  requisitionsList,
  salesOrdersList,
} from '@/js/api';

import { loginRedirect } from '@/js/utils/auth';

async function handleAuthError(error: unknown, request: Request) {
  if (error instanceof AxiosError && (error?.status === 401 || error?.status === 403)) {
    const url = new URL(request.url);
    throw loginRedirect(url.pathname + url.search);
  }
  throw error;
}

export async function productsLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const response = await productsList({
      query: {
        limit: Number(url.searchParams.get('limit') || 20),
        offset: Number(url.searchParams.get('offset') || 0),
      },
      throwOnError: true,
    });
    return response.data;
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function requisitionsLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  try {
    const [requisitionsResponse, productsResponse, locationsResponse] = await Promise.all([
      requisitionsList({
        query: {
          limit: Number(url.searchParams.get('limit') || 20),
          offset: Number(url.searchParams.get('offset') || 0),
          status,
        },
        throwOnError: true,
      }),
      productsList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
      inventoryLocationsList({ query: { limit: 200, offset: 0 }, throwOnError: true }),
    ]);
    return {
      ...requisitionsResponse.data,
      filters: { status: status ?? '' },
      products: productsResponse.data.results ?? [],
      locations: locationsResponse.data.results ?? [],
    };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function salesOrdersLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const [ordersResponse, clientsResponse, productsResponse] = await Promise.all([
      salesOrdersList({
        query: {
          limit: Number(url.searchParams.get('limit') || 20),
          offset: Number(url.searchParams.get('offset') || 0),
          status: url.searchParams.get('status') || undefined,
        },
        throwOnError: true,
      }),
      clientsList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
      productsList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
    ]);
    return {
      ...ordersResponse.data,
      clients: clientsResponse.data.results ?? [],
      products: productsResponse.data.results ?? [],
    };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function clientsLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const response = await clientsList({
      query: {
        limit: Number(url.searchParams.get('limit') || 20),
        offset: Number(url.searchParams.get('offset') || 0),
      },
      throwOnError: true,
    });
    return response.data;
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function providersLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const response = await providersList({
      query: {
        limit: Number(url.searchParams.get('limit') || 20),
        offset: Number(url.searchParams.get('offset') || 0),
      },
      throwOnError: true,
    });
    return response.data;
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function purchaseOrdersLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const [ordersResponse, providersResponse, productsResponse] = await Promise.all([
      purchaseOrdersList({
        query: {
          limit: Number(url.searchParams.get('limit') || 20),
          offset: Number(url.searchParams.get('offset') || 0),
          status: url.searchParams.get('status') || undefined,
        },
        throwOnError: true,
      }),
      providersList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
      productsList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
    ]);
    return {
      ...ordersResponse.data,
      providers: providersResponse.data.results ?? [],
      products: productsResponse.data.results ?? [],
    };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function logisticsDashboardLoader({ request }: { request: Request }) {
  try {
    const response = await logisticsDashboardStatsRetrieve({ throwOnError: false });
    return { logisticsStats: response.data ?? null };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

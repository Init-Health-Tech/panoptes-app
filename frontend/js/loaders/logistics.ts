import { AxiosError } from 'axios';
import { redirectDocument } from 'react-router';

import {
  logisticsDashboardStatsRetrieve,
  productsList,
  requisitionsList,
  salesOrdersList,
} from '@/js/api';

import { loginRedirectUrl } from '@/js/utils/auth';

async function handleAuthError(error: unknown, request: Request) {
  if (error instanceof AxiosError && (error?.status === 401 || error?.status === 403)) {
    const url = new URL(request.url);
    throw redirectDocument(loginRedirectUrl(url.pathname + url.search));
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
    const response = await requisitionsList({
      query: {
        limit: Number(url.searchParams.get('limit') || 20),
        offset: Number(url.searchParams.get('offset') || 0),
        status,
      },
      throwOnError: true,
    });
    return { ...response.data, filters: { status: status ?? '' } };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function salesOrdersLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const response = await salesOrdersList({
      query: {
        limit: Number(url.searchParams.get('limit') || 20),
        offset: Number(url.searchParams.get('offset') || 0),
        status: url.searchParams.get('status') || undefined,
      },
      throwOnError: true,
    });
    return response.data;
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

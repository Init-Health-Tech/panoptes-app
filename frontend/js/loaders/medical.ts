import { AxiosError } from 'axios';
import { redirectDocument } from 'react-router';

import { doctorsList, medicalDashboardStatsRetrieve, proceduresList, supplyKitsList } from '@/js/api';

import { loginRedirectUrl } from '@/js/utils/auth';

async function handleAuthError(error: unknown, request: Request) {
  if (error instanceof AxiosError && (error?.status === 401 || error?.status === 403)) {
    const url = new URL(request.url);
    const next = url.pathname + url.search + url.hash;
    throw redirectDocument(loginRedirectUrl(next));
  }
  throw error;
}

export async function supplyKitsLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') || 20);
  const offset = Number(url.searchParams.get('offset') || 0);
  const status = url.searchParams.get('status') || undefined;

  try {
    const response = await supplyKitsList({
      query: { limit, offset, status },
      throwOnError: true,
    });
    return { ...response.data, filters: { status: status ?? '' } };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function proceduresLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') || 20);
  const offset = Number(url.searchParams.get('offset') || 0);
  const status = url.searchParams.get('status') || undefined;

  try {
    const response = await proceduresList({
      query: { limit, offset, status },
      throwOnError: true,
    });
    return { ...response.data, filters: { status: status ?? '' } };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function doctorsLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') || 20);
  const offset = Number(url.searchParams.get('offset') || 0);

  try {
    const response = await doctorsList({
      query: { limit, offset },
      throwOnError: true,
    });
    return response.data;
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function medicalDashboardLoader({ request }: { request: Request }) {
  try {
    const response = await medicalDashboardStatsRetrieve({ throwOnError: false });
    return { medicalStats: response.data ?? null };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

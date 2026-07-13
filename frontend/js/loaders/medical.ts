import { AxiosError } from 'axios';
import { redirectDocument } from 'react-router';

import { doctorsList, medicalDashboardStatsRetrieve, proceduresList, rfidTagsList, supplyKitsList, techniciansList } from '@/js/api';

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
    const [kitsResponse, tagsResponse, proceduresResponse, allKitsResponse, techniciansResponse] =
      await Promise.all([
        supplyKitsList({
          query: { limit, offset, status },
          throwOnError: true,
        }),
        rfidTagsList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
        proceduresList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
        supplyKitsList({ query: { limit: 200, offset: 0 }, throwOnError: true }),
        techniciansList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
      ]);
    const linkedProcedureIds = new Set(
      (allKitsResponse.data.results ?? [])
        .map((kit) => kit.procedure)
        .filter((id): id is number => id != null),
    );
    const proceduresWithoutKit = (proceduresResponse.data.results ?? []).filter(
      (procedure) => !linkedProcedureIds.has(procedure.id),
    );

    return {
      ...kitsResponse.data,
      filters: { status: status ?? '' },
      tags: tagsResponse.data.results ?? [],
      technicians: techniciansResponse.data.results ?? [],
      proceduresWithoutKit,
    };
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
    const [response, doctorsResponse] = await Promise.all([
      proceduresList({
        query: { limit, offset, status },
        throwOnError: true,
      }),
      doctorsList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
    ]);
    return {
      ...response.data,
      filters: { status: status ?? '' },
      doctors: doctorsResponse.data.results ?? [],
    };
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

export async function techniciansLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') || 20);
  const offset = Number(url.searchParams.get('offset') || 0);

  try {
    const response = await techniciansList({
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

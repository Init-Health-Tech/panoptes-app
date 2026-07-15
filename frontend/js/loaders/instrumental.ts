import { AxiosError } from 'axios';

import {
  doctorsList,
  fulfillmentPlansList,
  hospitalSitesList,
  instrumentalDashboardStatsRetrieve,
  instrumentCatalogList,
  instrumentPriceContractsList,
  instrumentProcedureRequestsList,
  instrumentProcedureRequestsRetrieve,
  instrumentQuotationsList,
  materialDispatchesList,
  proceduresList,
  rfidTagsList,
  techniciansList,
  transportVehiclesList,
} from '@/js/api';
import { loginRedirect } from '@/js/utils/auth';

async function handleAuthError(error: unknown, request: Request) {
  if (error instanceof AxiosError && (error?.status === 401 || error?.status === 403)) {
    const url = new URL(request.url);
    throw loginRedirect(url.pathname + url.search);
  }
  throw error;
}

export async function instrumentalContractsLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const [contractsResponse, doctorsResponse, hospitalsResponse, catalogResponse] = await Promise.all([
      instrumentPriceContractsList({
        query: {
          limit: Number(url.searchParams.get('limit') || 50),
          offset: Number(url.searchParams.get('offset') || 0),
        },
        throwOnError: true,
      }),
      doctorsList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
      hospitalSitesList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
      instrumentCatalogList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
    ]);
    return {
      ...contractsResponse.data,
      doctors: doctorsResponse.data.results ?? [],
      hospitals: hospitalsResponse.data.results ?? [],
      catalog: catalogResponse.data.results ?? [],
    };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function instrumentalFlowLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const search = url.searchParams.get('search') || url.searchParams.get('q') || '';
    const statusFilter = url.searchParams.get('status') || '';
    const [requestsResponse, plansResponse, vehiclesResponse, techniciansResponse, hospitalsResponse] =
      await Promise.all([
        instrumentProcedureRequestsList({
          query: {
            limit: Number(url.searchParams.get('limit') || 50),
            offset: Number(url.searchParams.get('offset') || 0),
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(search ? { search } : {}),
          } as { limit?: number; offset?: number; status?: string; search?: string },
          throwOnError: true,
        }),
        fulfillmentPlansList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
        transportVehiclesList({ query: { limit: 50, offset: 0 }, throwOnError: true }),
        techniciansList({ query: { limit: 50, offset: 0 }, throwOnError: true }),
        hospitalSitesList({ query: { limit: 50, offset: 0 }, throwOnError: true }),
      ]);
    return {
      ...requestsResponse.data,
      plans: plansResponse.data.results ?? [],
      vehicles: vehiclesResponse.data.results ?? [],
      technicians: techniciansResponse.data.results ?? [],
      hospitals: hospitalsResponse.data.results ?? [],
      filters: { status: statusFilter, search },
    };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function instrumentalRequestsLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const [requestsResponse, proceduresResponse, doctorsResponse, hospitalsResponse, catalogResponse] =
      await Promise.all([
        instrumentProcedureRequestsList({
          query: {
            limit: Number(url.searchParams.get('limit') || 20),
            offset: Number(url.searchParams.get('offset') || 0),
            ...(url.searchParams.get('status') ? { status: url.searchParams.get('status')! } : {}),
          } as { limit?: number; offset?: number; status?: string },
          throwOnError: true,
        }),
        proceduresList({ query: { limit: 50, offset: 0 }, throwOnError: true }),
        doctorsList({ query: { limit: 50, offset: 0 }, throwOnError: true }),
        hospitalSitesList({ query: { limit: 50, offset: 0 }, throwOnError: true }),
        instrumentCatalogList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
      ]);
    return {
      ...requestsResponse.data,
      procedures: proceduresResponse.data.results ?? [],
      doctors: doctorsResponse.data.results ?? [],
      hospitals: hospitalsResponse.data.results ?? [],
      catalog: catalogResponse.data.results ?? [],
      filters: { status: url.searchParams.get('status') ?? '' },
    };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function instrumentalQuotationsLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const response = await instrumentQuotationsList({
      query: {
        limit: Number(url.searchParams.get('limit') || 20),
        offset: Number(url.searchParams.get('offset') || 0),
        ...(url.searchParams.get('status') ? { status: url.searchParams.get('status')! } : { status: 'pending_doctor' }),
      } as { limit?: number; offset?: number; status?: string },
      throwOnError: true,
    });
    return { ...response.data, filters: { status: url.searchParams.get('status') ?? 'pending_doctor' } };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function instrumentalFulfillmentLoader({ request }: { request: Request }) {
  try {
    const [plansResponse, requestsResponse, vehiclesResponse, techniciansResponse] = await Promise.all([
      fulfillmentPlansList({ query: { limit: 20, offset: 0 }, throwOnError: true }),
      instrumentProcedureRequestsList({
        query: {
          limit: 50,
          offset: 0,
          status: 'quotation_accepted',
        } as { limit?: number; offset?: number; status?: string },
        throwOnError: true,
      }),
      transportVehiclesList({ query: { limit: 50, offset: 0 }, throwOnError: true }),
      techniciansList({ query: { limit: 50, offset: 0 }, throwOnError: true }),
    ]);
    return {
      plans: plansResponse.data.results ?? [],
      acceptedRequests: requestsResponse.data.results ?? [],
      vehicles: vehiclesResponse.data.results ?? [],
      technicians: techniciansResponse.data.results ?? [],
      dispatches: (
        await materialDispatchesList({ query: { limit: 50, offset: 0 }, throwOnError: true })
      ).data.results ?? [],
    };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function instrumentalLoadLoader({
  request,
  params,
}: {
  request: Request;
  params: { requestId?: string };
}) {
  const requestId = Number(params.requestId);
  if (!requestId) {
    throw new Response('Solicitud no encontrada', { status: 404 });
  }
  try {
    const [reqResponse, plansResponse, hospitalsResponse] = await Promise.all([
      instrumentProcedureRequestsRetrieve({ path: { id: requestId }, throwOnError: true }),
      fulfillmentPlansList({ query: { limit: 100, offset: 0 }, throwOnError: true }),
      hospitalSitesList({ query: { limit: 50, offset: 0 }, throwOnError: true }),
    ]);
    const plan =
      (plansResponse.data.results ?? []).find((p) => p.request === requestId) ?? null;
    return {
      request: reqResponse.data,
      plan,
      hospitals: hospitalsResponse.data.results ?? [],
      returnTo: new URL(request.url).searchParams.get('returnTo') || '/instrumental',
    };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function instrumentalHandheldLoader({ request }: { request: Request }) {
  try {
    const hospitalsResponse = await hospitalSitesList({ query: { limit: 50, offset: 0 }, throwOnError: true });
    return { hospitals: hospitalsResponse.data.results ?? [] };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function instrumentalDashboardLoader({ request }: { request: Request }) {
  try {
    const response = await instrumentalDashboardStatsRetrieve({ throwOnError: false });
    return { instrumentalStats: response.data ?? null };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function instrumentCatalogLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const response = await instrumentCatalogList({
      query: {
        limit: Number(url.searchParams.get('limit') || 50),
        offset: Number(url.searchParams.get('offset') || 0),
      },
      throwOnError: true,
    });
    return response.data;
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function hospitalSitesLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const response = await hospitalSitesList({
      query: {
        limit: Number(url.searchParams.get('limit') || 50),
        offset: Number(url.searchParams.get('offset') || 0),
      },
      throwOnError: true,
    });
    return response.data;
  } catch (error) {
    return handleAuthError(error, request);
  }
}

export async function transportVehiclesLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    const [response, tagsResponse] = await Promise.all([
      transportVehiclesList({
        query: {
          limit: Number(url.searchParams.get('limit') || 50),
          offset: Number(url.searchParams.get('offset') || 0),
        },
        throwOnError: true,
      }),
      rfidTagsList({ query: { limit: 200, offset: 0 }, throwOnError: false }),
    ]);
    return {
      ...response.data,
      rfidTags: tagsResponse.data?.results ?? [],
    };
  } catch (error) {
    return handleAuthError(error, request);
  }
}

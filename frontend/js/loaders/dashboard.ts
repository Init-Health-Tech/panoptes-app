import { AxiosError } from 'axios';
import { redirectDocument } from 'react-router';

import { inventoryDashboardStatsRetrieve, logisticsDashboardStatsRetrieve, medicalDashboardStatsRetrieve } from '@/js/api';
import { loginRedirectUrl } from '@/js/utils/auth';

export async function dashboardLoader({ request }: { request: Request }) {
  try {
    const [inventoryResponse, medicalResponse, logisticsResponse] = await Promise.all([
      inventoryDashboardStatsRetrieve({ throwOnError: false }),
      medicalDashboardStatsRetrieve({ throwOnError: false }),
      logisticsDashboardStatsRetrieve({ throwOnError: false }),
    ]);
    return {
      stats: inventoryResponse.data ?? null,
      medicalStats: medicalResponse.data ?? null,
      logisticsStats: logisticsResponse.data ?? null,
    };
  } catch (error) {
    if (error instanceof AxiosError && (error?.status === 401 || error?.status === 403)) {
      const url = new URL(request.url);
      const next = url.pathname + url.search + url.hash;
      throw redirectDocument(loginRedirectUrl(next));
    }
    return { stats: null, medicalStats: null, logisticsStats: null };
  }
}

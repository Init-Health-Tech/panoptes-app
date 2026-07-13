import { AxiosError } from 'axios';
import { redirectDocument } from 'react-router';

import {
  inventoryDashboardStatsRetrieve,
  instrumentalDashboardStatsRetrieve,
  logisticsDashboardStatsRetrieve,
  medicalDashboardStatsRetrieve,
} from '@/js/api';
import { dashboardChartsRetrieve } from '@/js/api/platformExtras';
import { loginRedirectUrl } from '@/js/utils/auth';

export async function dashboardLoader({ request }: { request: Request }) {
  try {
    const [inventoryResponse, medicalResponse, logisticsResponse, instrumentalResponse, chartsResponse] =
      await Promise.all([
        inventoryDashboardStatsRetrieve({ throwOnError: false }),
        medicalDashboardStatsRetrieve({ throwOnError: false }),
        logisticsDashboardStatsRetrieve({ throwOnError: false }),
        instrumentalDashboardStatsRetrieve({ throwOnError: false }),
        dashboardChartsRetrieve(),
      ]);
    return {
      stats: inventoryResponse.data ?? null,
      medicalStats: medicalResponse.data ?? null,
      logisticsStats: logisticsResponse.data ?? null,
      instrumentalStats: instrumentalResponse.data ?? null,
      charts: chartsResponse.data ?? null,
    };
  } catch (error) {
    if (error instanceof AxiosError && (error?.status === 401 || error?.status === 403)) {
      const url = new URL(request.url);
      const next = url.pathname + url.search + url.hash;
      throw redirectDocument(loginRedirectUrl(next));
    }
    return {
      stats: null,
      medicalStats: null,
      logisticsStats: null,
      instrumentalStats: null,
      charts: null,
    };
  }
}

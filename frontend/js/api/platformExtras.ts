import { client } from '@/js/api/client.gen';

const security = [
  {
    in: 'cookie' as const,
    name: 'sessionid',
    type: 'apiKey' as const,
  },
];

export type PlatformOrganization = {
  id: number;
  name: string;
  slug: string;
  industry_type: string;
  account_type: string;
  is_active: boolean;
  contact_name: string;
  contact_email: string;
  notes: string;
  demo_duration_days: number;
  demo_expires_at: string | null;
  demo_locked: boolean;
  is_demo_expired: boolean;
  active_modules: string[];
  packages: string[];
  member_count: number;
  demo_credentials?: {
    email: string;
    password: string | null;
    demo_expires_at: string;
  };
};

export type ProductPackage = {
  id: number;
  code: string;
  name: string;
  description: string;
  is_public: boolean;
  modules: string[];
};

export type DashboardCharts = {
  inventory: { labels: string[]; values: number[]; total: number } | null;
  instrumental_funnel: { labels: string[]; values: number[]; total: number } | null;
};

export async function platformOrganizationsList() {
  return client.get<PlatformOrganization[], unknown, true>({
    responseType: 'json',
    security,
    url: '/api/platform/organizations/',
    throwOnError: true,
  });
}

export async function platformProvisionDemo(body: {
  name: string;
  contact_email: string;
  contact_name?: string;
  duration_days: number;
  package_codes: string[];
  industry_type?: string;
  password?: string;
}) {
  return client.post<PlatformOrganization, unknown, true>({
    responseType: 'json',
    security,
    url: '/api/platform/organizations/',
    body,
    throwOnError: true,
  });
}

export async function platformPurgeDemo(id: number) {
  return client.post<{ ok: boolean; counts: Record<string, number> }, unknown, true>({
    responseType: 'json',
    security,
    url: '/api/platform/organizations/{id}/purge-demo/',
    path: { id },
    throwOnError: true,
  });
}

export async function platformExtendDemo(id: number, extra_days: number) {
  return client.post<PlatformOrganization, unknown, true>({
    responseType: 'json',
    security,
    url: '/api/platform/organizations/{id}/extend-demo/',
    path: { id },
    body: { extra_days },
    throwOnError: true,
  });
}

export async function platformPackagesList() {
  return client.get<ProductPackage[], unknown, true>({
    responseType: 'json',
    security,
    url: '/api/platform/packages/',
    throwOnError: true,
  });
}

export async function platformUsageSummary() {
  return client.get<
    {
      window_days: number;
      demo_count: number;
      demos_expiring_soon: number;
      by_organization: Array<{
        organization_id: number;
        organization__name: string;
        organization__slug: string;
        requests: number;
        users: number;
        ips: number;
      }>;
      by_module: Array<{ module_code: string; requests: number }>;
    },
    unknown,
    true
  >({
    responseType: 'json',
    security,
    url: '/api/platform/usage/summary/',
    throwOnError: true,
  });
}

export async function dashboardChartsRetrieve() {
  return client.get<DashboardCharts, unknown, false>({
    responseType: 'json',
    security,
    url: '/api/dashboard/charts/',
    throwOnError: false,
  });
}

export async function demoRequestLicenseRetrieve() {
  return client.get<
    { sales_email: string; mailto: string; organization: string | null; is_demo_expired: boolean },
    unknown,
    true
  >({
    responseType: 'json',
    security,
    url: '/api/demo/request-license/',
    throwOnError: true,
  });
}

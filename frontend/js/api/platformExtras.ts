/**
 * Manual API helpers for platform admin / demo / dashboard charts.
 * OpenAPI schema for several of these endpoints lacks response serializers,
 * so we keep typed wrappers here instead of relying on incomplete generated types.
 */
import { client } from '@/js/api/client.gen';
import {
  dashboardChartsRetrieve as sdkDashboardChartsRetrieve,
  demoRequestLicenseRetrieve as sdkDemoRequestLicenseRetrieve,
  platformOrganizationsCreate,
  platformOrganizationsList as sdkPlatformOrganizationsList,
  platformOrganizationsPurgeDemoCreate,
  platformPackagesRetrieve,
  platformUsageSummaryRetrieve,
} from '@/js/api/sdk.gen';

export type ChartSeries = {
  labels: string[];
  values: number[];
  total?: number;
};

export type DashboardCharts = {
  inventory: ChartSeries | null;
  instrumental_funnel: ChartSeries | null;
};

export type DemoLicenseInfo = {
  sales_email: string;
  mailto: string;
  organization: string | null;
  is_demo_expired: boolean;
};

export type ProductPackage = {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_public?: boolean;
  modules: string[];
};

export type PlatformOrganization = {
  id: number;
  name: string;
  slug: string;
  industry_type?: string;
  account_type?: string;
  is_active?: boolean;
  contact_name?: string;
  contact_email?: string;
  notes?: string;
  demo_duration_days?: number;
  demo_expires_at: string | null;
  demo_locked?: boolean;
  is_demo_expired?: boolean;
  active_modules: string[];
  packages: string[];
  member_count: number;
  demo_credentials?: {
    email: string;
    password: string | null;
    demo_expires_at?: string | null;
  };
};

export type PlatformUsageSummary = {
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
  by_module: Array<{
    module_code: string;
    requests: number;
  }>;
};

function normalizeOrg(raw: Record<string, unknown>): PlatformOrganization {
  const modules = raw.active_modules;
  const packages = raw.packages;
  return {
    ...(raw as unknown as PlatformOrganization),
    active_modules: Array.isArray(modules) ? (modules as string[]) : [],
    packages: Array.isArray(packages) ? (packages as string[]) : [],
    member_count: typeof raw.member_count === 'number' ? raw.member_count : Number(raw.member_count) || 0,
  };
}

export async function dashboardChartsRetrieve() {
  const response = await sdkDashboardChartsRetrieve({ throwOnError: false });
  return {
    ...response,
    data: (response.data ?? null) as DashboardCharts | null,
  };
}

export async function demoRequestLicenseRetrieve() {
  const response = await sdkDemoRequestLicenseRetrieve({ throwOnError: true });
  return {
    ...response,
    data: response.data as DemoLicenseInfo,
  };
}

export async function platformOrganizationsList() {
  const response = await sdkPlatformOrganizationsList({ throwOnError: true });
  const rows = (response.data ?? []) as unknown as Record<string, unknown>[];
  return {
    ...response,
    data: rows.map(normalizeOrg),
  };
}

export async function platformPackagesList() {
  const response = await platformPackagesRetrieve({ throwOnError: true });
  return {
    ...response,
    data: (response.data ?? []) as ProductPackage[],
  };
}

export async function platformUsageSummary() {
  const response = await platformUsageSummaryRetrieve({ throwOnError: true });
  return {
    ...response,
    data: (response.data ?? null) as PlatformUsageSummary | null,
  };
}

export type ProvisionDemoPayload = {
  name: string;
  contact_email: string;
  contact_name?: string;
  duration_days?: number;
  package_codes?: string[];
  industry_type?: 'clinical' | 'logistics' | 'mixed';
  password?: string;
};

export async function platformProvisionDemo(body: ProvisionDemoPayload) {
  const response = await platformOrganizationsCreate({
    body,
    throwOnError: true,
  });
  const raw = response.data as unknown as Record<string, unknown>;
  return {
    ...response,
    data: normalizeOrg(raw),
  };
}

export async function platformPurgeDemo(organizationId: number) {
  return platformOrganizationsPurgeDemoCreate({
    path: { id: organizationId },
    throwOnError: true,
  });
}

export async function platformExtendDemo(organizationId: number, extraDays: number) {
  // Schema omits the request body; call the client directly.
  return client.post({
    url: `/api/platform/organizations/${organizationId}/extend-demo/`,
    body: { extra_days: extraDays },
    headers: { 'Content-Type': 'application/json' },
    security: [{ in: 'cookie', name: 'sessionid', type: 'apiKey' }],
    throwOnError: true,
  });
}

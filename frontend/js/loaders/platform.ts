import { AxiosError } from 'axios';

import {
  platformOrganizationsList,
  platformPackagesList,
  platformUsageSummary,
} from '@/js/api/platformExtras';

export async function platformAdminLoader() {
  try {
    const [orgs, packages, usage] = await Promise.all([
      platformOrganizationsList(),
      platformPackagesList(),
      platformUsageSummary(),
    ]);
    return {
      organizations: orgs.data ?? [],
      packages: packages.data ?? [],
      usage: usage.data ?? null,
      forbidden: false,
    };
  } catch (error) {
    if (error instanceof AxiosError && (error.status === 403 || error.status === 401)) {
      return { organizations: [], packages: [], usage: null, forbidden: true };
    }
    return { organizations: [], packages: [], usage: null, forbidden: true };
  }
}

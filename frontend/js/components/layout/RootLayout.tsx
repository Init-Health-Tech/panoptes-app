import { Outlet, useLoaderData } from 'react-router';

import { ModulesContext } from '@/js/context/ModulesContext';
import type { ActiveModules } from '@/js/types/modules';

export function RootLayout() {
  const modules = useLoaderData<ActiveModules>();

  return (
    <ModulesContext.Provider value={modules}>
      <Outlet />
    </ModulesContext.Provider>
  );
}

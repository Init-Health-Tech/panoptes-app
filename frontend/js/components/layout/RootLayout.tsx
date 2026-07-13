import { Outlet, useLoaderData } from 'react-router';

import { DemoExpiredGate } from '@/js/components/layout/DemoExpiredGate';
import { ModulesContext } from '@/js/context/ModulesContext';
import type { ActiveModules } from '@/js/types/modules';

export function RootLayout() {
  const modules = useLoaderData<ActiveModules>();

  return (
    <ModulesContext.Provider value={modules}>
      <DemoExpiredGate>
        <Outlet />
      </DemoExpiredGate>
    </ModulesContext.Provider>
  );
}

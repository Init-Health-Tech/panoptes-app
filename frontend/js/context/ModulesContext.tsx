import { createContext, useContext } from 'react';

import type { ActiveModules } from '@/js/types/modules';

export const ModulesContext = createContext<ActiveModules | null>(null);

export function useModules() {
  const context = useContext(ModulesContext);
  if (!context) {
    throw new Error('useModules must be used within ModulesProvider');
  }
  return context;
}

export function useOptionalModules() {
  return useContext(ModulesContext);
}

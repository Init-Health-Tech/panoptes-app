import { Navigate, useLocation } from 'react-router';

import { hasModuleAccess } from '@/js/config/modules';
import { useOptionalModules } from '@/js/context/ModulesContext';

type ModuleGuardProps = {
  /** One module code, or any-of list (e.g. medical + instrumental product). */
  moduleCode: string | string[];
  children: React.ReactNode;
};

export function ModuleGuard({ moduleCode, children }: ModuleGuardProps) {
  const modules = useOptionalModules();
  const location = useLocation();

  if (!modules) {
    return null;
  }

  if (!hasModuleAccess(modules.modules, moduleCode)) {
    return <Navigate replace state={{ from: location.pathname }} to="/" />;
  }

  return children;
}

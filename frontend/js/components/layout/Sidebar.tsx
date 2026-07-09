import { NavLink } from 'react-router';

import { getNavItemsForModules, SECTION_LABELS, type NavSection } from '@/js/config/modules';
import { useOptionalModules } from '@/js/context/ModulesContext';
import { LogoutButton } from '@/js/components/layout/LogoutButton';

function NavSectionGroup({ section, items }: { section: NavSection; items: ReturnType<typeof getNavItemsForModules> }) {
  const sectionItems = items.filter((item) => item.section === section);
  if (sectionItems.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {SECTION_LABELS[section]}
      </p>
      <div className="space-y-1">
        {sectionItems.map((item) => (
          <NavLink
            key={item.path}
            className={({ isActive }) =>
              [
                'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-secondary-container/50 text-primary before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
              ].join(' ')
            }
            to={item.path}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const modules = useOptionalModules();
  const navItems = getNavItemsForModules(modules?.modules ?? []);

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-outline-variant/30 bg-surface-container-lowest py-6 shadow-[var(--shadow-card)]">
      <div className="mb-8 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary">
            <span className="material-symbols-outlined filled">sensors</span>
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-primary">
              Panoptes
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              {modules?.organization?.name ?? 'RFID Control'}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <NavLink
          className={({ isActive }) =>
            [
              'relative mb-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
              isActive
                ? 'bg-secondary-container/50 text-primary before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high',
            ].join(' ')
          }
          end
          to="/"
        >
          <span className="material-symbols-outlined text-[20px]">dashboard</span>
          Dashboard
        </NavLink>

        <NavSectionGroup items={navItems} section="core" />
        <NavSectionGroup items={navItems} section="medical" />
        <NavSectionGroup items={navItems} section="logistics" />
      </nav>

      {modules?.role && (
        <div className="mx-4 mt-4 space-y-2">
          <div className="rounded-lg bg-surface-container px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Rol
            </p>
            <p className="text-sm font-medium capitalize text-on-surface">{modules.role.replace('_', ' ')}</p>
          </div>
          <LogoutButton />
        </div>
      )}
    </aside>
  );
}

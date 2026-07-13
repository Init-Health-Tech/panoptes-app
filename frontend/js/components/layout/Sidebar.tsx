import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { NavLink, useLocation } from 'react-router';

import { getNavItemsForModules, SECTION_LABELS, type NavSection } from '@/js/config/modules';
import { useOptionalModules } from '@/js/context/ModulesContext';
import { LogoutButton } from '@/js/components/layout/LogoutButton';
import { PanoptesLogo } from '@/js/components/ui/PanoptesLogo';

const SIDEBAR_NAV_SCROLL_KEY = 'panoptes-sidebar-nav-scroll';

function saveNavScroll(el: HTMLElement | null) {
  if (!el) return;
  try {
    sessionStorage.setItem(SIDEBAR_NAV_SCROLL_KEY, String(el.scrollTop));
  } catch {
    // ignore quota / private mode
  }
}

function restoreNavScroll(el: HTMLElement | null) {
  if (!el) return;
  try {
    const saved = sessionStorage.getItem(SIDEBAR_NAV_SCROLL_KEY);
    if (saved != null) {
      el.scrollTop = Number(saved) || 0;
    }
  } catch {
    // ignore
  }
}

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  /** Desktop: icon rail vs full labels */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

function NavSectionGroup({
  section,
  items,
  onNavigate,
  collapsed,
  navRef,
}: {
  section: NavSection;
  items: ReturnType<typeof getNavItemsForModules>;
  onNavigate: () => void;
  collapsed?: boolean;
  navRef: RefObject<HTMLElement | null>;
}) {
  const sectionItems = items.filter((item) => item.section === section);
  if (sectionItems.length === 0) return null;

  const handleNavigate = () => {
    saveNavScroll(navRef.current);
    onNavigate();
  };

  return (
    <div className={collapsed ? 'mb-2' : 'mb-4'}>
      {!collapsed && (
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          {SECTION_LABELS[section]}
        </p>
      )}
      <div className="space-y-1">
        {sectionItems.map((item) => (
          <NavLink
            key={item.path}
            className={({ isActive }) =>
              [
                'relative flex min-h-11 items-center rounded-lg text-sm font-medium transition',
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-secondary-container/50 text-primary before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
              ].join(' ')
            }
            data-tour={
              item.path === '/inventory'
                ? 'nav-inventory'
                : item.path === '/supply-kits'
                  ? 'nav-supply-kits'
                  : item.path === '/instrumental'
                    ? 'nav-instrumental'
                    : undefined
            }
            onClick={handleNavigate}
            title={collapsed ? item.label : undefined}
            to={item.path}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            {!collapsed && item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function SidebarPanel({
  onNavigate,
  collapsed,
  onToggleCollapse,
  showCollapseToggle,
}: {
  onNavigate: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  showCollapseToggle?: boolean;
}) {
  const modules = useOptionalModules();
  const navItems = getNavItemsForModules(modules?.modules ?? []);
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    restoreNavScroll(navRef.current);
  }, []);

  const handleNavigate = () => {
    saveNavScroll(navRef.current);
    onNavigate();
  };

  return (
    <>
      <div className={`mb-4 pt-2 ${collapsed ? 'px-2' : 'mb-6 px-5'}`} data-tour="sidebar-brand">
        <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'gap-3'}`}>
          <PanoptesLogo className="shrink-0" size={collapsed ? 32 : 40} />
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-primary">
                Panoptes
              </h1>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                {modules?.organization?.name ?? 'RFID Control'}
              </p>
            </div>
          )}
        </div>
        {showCollapseToggle && onToggleCollapse && (
          <button
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className={`mt-3 inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface ${
              collapsed ? 'w-full' : ''
            }`}
            onClick={onToggleCollapse}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]">
              {collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
            </span>
          </button>
        )}
      </div>

      <nav
        className={`flex-1 overflow-y-auto overscroll-contain pb-4 ${collapsed ? 'px-1.5' : 'px-3'}`}
        onScroll={(e) => saveNavScroll(e.currentTarget)}
        ref={navRef}
      >
        <NavLink
          className={({ isActive }) =>
            [
              'relative mb-2 flex min-h-11 items-center rounded-lg text-sm font-medium transition',
              collapsed ? 'justify-center px-2 py-2.5' : 'mb-4 gap-3 px-3 py-2.5',
              isActive
                ? 'bg-secondary-container/50 text-primary before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high',
            ].join(' ')
          }
          end
          onClick={handleNavigate}
          title={collapsed ? 'Dashboard' : undefined}
          to="/"
        >
          <span className="material-symbols-outlined text-[20px]">dashboard</span>
          {!collapsed && 'Dashboard'}
        </NavLink>

        {modules?.is_platform_admin && (
          <NavLink
            className={({ isActive }) =>
              [
                'relative mb-2 flex min-h-11 items-center rounded-lg text-sm font-medium transition',
                collapsed ? 'justify-center px-2 py-2.5' : 'mb-4 gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-secondary-container/50 text-primary before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high',
              ].join(' ')
            }
            onClick={handleNavigate}
            title={collapsed ? 'Platform admin' : undefined}
            to="/platform"
          >
            <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
            {!collapsed && 'Platform admin'}
          </NavLink>
        )}

        <NavSectionGroup
          collapsed={collapsed}
          items={navItems}
          navRef={navRef}
          onNavigate={onNavigate}
          section="core"
        />
        <NavSectionGroup
          collapsed={collapsed}
          items={navItems}
          navRef={navRef}
          onNavigate={onNavigate}
          section="instrumental"
        />
        <NavSectionGroup
          collapsed={collapsed}
          items={navItems}
          navRef={navRef}
          onNavigate={onNavigate}
          section="logistics"
        />
      </nav>

      {modules?.role && (
        <div
          className={`space-y-2 border-t border-outline-variant/30 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
            collapsed ? 'px-1.5' : 'px-4'
          }`}
        >
          {!collapsed && (
            <div className="rounded-lg bg-surface-container px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Rol
              </p>
              <p className="text-sm font-medium capitalize text-on-surface">
                {modules.role.replace('_', ' ')}
              </p>
            </div>
          )}
          <LogoutButton compact={collapsed} />
        </div>
      )}
    </>
  );
}

export function Sidebar({ open, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const titleId = useId();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-40 hidden h-dvh flex-col border-r border-outline-variant/30 bg-surface-container-lowest py-4 shadow-[var(--shadow-card)] transition-[width] duration-200 ease-out lg:flex ${
          collapsed ? 'w-[4.5rem]' : 'w-64'
        }`}
      >
        <SidebarPanel
          collapsed={collapsed}
          onNavigate={() => undefined}
          onToggleCollapse={onToggleCollapse}
          showCollapseToggle
        />
      </aside>

      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-50 lg:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <button
          aria-label="Cerrar menú"
          className={`absolute inset-0 bg-on-surface/55 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
          type="button"
        />
        <aside
          aria-labelledby={titleId}
          aria-modal="true"
          className={`absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] max-w-full flex-col border-r border-outline-variant/30 bg-surface-container-lowest pt-[env(safe-area-inset-top)] shadow-[var(--shadow-card)] transition-transform duration-200 ease-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
          role="dialog"
        >
          <div className="flex items-center justify-between px-4 py-2">
            <p className="sr-only" id={titleId}>
              Menú de navegación
            </p>
            <button
              aria-label="Cerrar menú"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
              onClick={onClose}
              type="button"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <SidebarPanel onNavigate={onClose} />
        </aside>
      </div>
    </>
  );
}

type MobileTopBarProps = {
  onOpenNav: () => void;
  endSlot?: ReactNode;
};

export function MobileTopBar({ onOpenNav, endSlot }: MobileTopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-outline-variant/30 bg-surface-container-lowest/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/80 lg:hidden">
      <button
        aria-label="Abrir menú"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-primary hover:bg-secondary-container/40"
        onClick={onOpenNav}
        type="button"
      >
        <span className="material-symbols-outlined text-[26px]">menu</span>
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <PanoptesLogo className="shrink-0" size={28} />
        <span className="truncate font-[family-name:var(--font-display)] text-base font-bold text-primary">
          Panoptes
        </span>
      </div>
      {endSlot}
    </header>
  );
}

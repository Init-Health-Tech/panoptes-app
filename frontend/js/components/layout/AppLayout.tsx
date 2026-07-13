import { useState, type ReactNode } from 'react';

import { MobileTopBar, Sidebar } from '@/js/components/layout/Sidebar';
import { GuidedTour, TourHelpButton, useGuidedTour } from '@/js/components/ui/GuidedTour';
import { TOURS } from '@/js/config/tours';
import { useSidebarCollapse } from '@/js/hooks/useSidebarCollapse';

type AppLayoutProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Guided spotlight tour for this screen (auto first visit + ? button). */
  tourId?: string;
  /** Tighter page chrome for dense operational screens (PC). */
  dense?: boolean;
};

export function AppLayout({ children, title, subtitle, actions, tourId, dense = false }: AppLayoutProps) {
  const tour = useGuidedTour(tourId && TOURS[tourId] ? tourId : undefined);
  const [navOpen, setNavOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapse();

  const helpButton = tourId && TOURS[tourId] ? <TourHelpButton onStart={tour.start} /> : null;

  return (
    <div className="min-h-dvh bg-surface">
      <Sidebar
        collapsed={collapsed}
        onClose={() => setNavOpen(false)}
        onToggleCollapse={toggle}
        open={navOpen}
      />
      <MobileTopBar endSlot={helpButton} onOpenNav={() => setNavOpen(true)} />

      <main
        className={[
          'min-h-dvh px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] transition-[margin] duration-200 ease-out sm:px-6',
          dense ? 'py-3 lg:py-4' : 'py-4 lg:py-6 xl:py-8',
          collapsed ? 'lg:ml-[4.5rem]' : 'lg:ml-64',
          dense ? 'lg:px-5 xl:px-6' : 'lg:px-8 xl:px-10',
        ].join(' ')}
      >
        <div className={dense ? 'mx-auto w-full max-w-[100rem]' : 'panoptes-workspace'}>
          {(title || actions || tourId) && (
            <header
              className={`flex flex-wrap items-end justify-between gap-3 ${
                dense ? 'mb-3 sm:mb-4' : 'mb-4 sm:mb-6 sm:gap-4'
              }`}
            >
              <div className="min-w-0 flex-1" data-tour="page-title">
                {title && (
                  <h1
                    className={`font-[family-name:var(--font-display)] font-bold tracking-tight text-primary ${
                      dense ? 'text-xl sm:text-2xl' : 'text-xl sm:text-2xl xl:text-3xl'
                    }`}
                  >
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-0.5 max-w-3xl text-sm text-on-surface-variant">{subtitle}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {actions}
                <span className="hidden lg:inline-flex">{helpButton}</span>
              </div>
            </header>
          )}
          {children}
        </div>
      </main>
      {tourId && TOURS[tourId] && (
        <GuidedTour open={tour.open} onClose={tour.close} tourId={tourId} />
      )}
    </div>
  );
}

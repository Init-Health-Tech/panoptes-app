import type { ReactNode } from 'react';

import { Sidebar } from '@/js/components/layout/Sidebar';

type AppLayoutProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <main className="ml-64 min-h-screen p-6 lg:p-8">
        {(title || actions) && (
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              {title && (
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary">
                  {title}
                </h1>
              )}
              {subtitle && <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </header>
        )}
        {children}
      </main>
    </div>
  );
}

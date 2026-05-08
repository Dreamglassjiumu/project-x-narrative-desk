import type { ReactNode } from 'react';
import type { PageKey } from '../../data';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell({ children, page, onNavigate, query, onQueryChange }: { children: ReactNode; page: PageKey; onNavigate: (page: PageKey) => void; query: string; onQueryChange: (value: string) => void }) {
  return (
    <div className="min-h-screen bg-espresso text-ivory lg:flex">
      <Sidebar currentPage={page} onNavigate={onNavigate} />
      <main className="relative min-w-0 flex-1">
        <div className="smoke-overlay" />
        <TopBar page={page} query={query} onQueryChange={onQueryChange} />
        <div className="relative z-10 p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}

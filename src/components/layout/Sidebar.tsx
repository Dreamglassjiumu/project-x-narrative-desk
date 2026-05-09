import type { PageKey } from '../../data';

const items: Array<{ key: PageKey; label: string; code: string }> = [
  { key: 'dashboard', label: 'Dashboard', code: '00' },
  { key: 'factions', label: 'Factions', code: '09' },
  { key: 'districts', label: 'Districts & POI', code: '22' },
  { key: 'characters', label: 'Characters', code: '47' },
  { key: 'storylines', label: 'Storylines', code: '61' },
  { key: 'pitch', label: 'Pitch Desk', code: 'PX' },
  { key: 'library', label: 'Local Library', code: 'EV' },
  { key: 'intake', label: 'Evidence Intake', code: 'IN' },
];

export function Sidebar({ currentPage, onNavigate }: { currentPage: PageKey; onNavigate: (page: PageKey) => void }) {
  return (
    <aside className="w-full border-b border-brass/20 bg-espresso/95 p-4 shadow-dossier lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="mb-8 border border-brass/30 bg-walnut/60 p-4">
        <p className="type-label text-brass">SAN LIBRE PD ARCHIVE</p>
        <h1 className="font-display text-2xl text-ivory">Project：X</h1>
        <p className="mt-1 text-sm text-paper/70">Narrative Desk / 叙事情报系统</p>
      </div>
      <nav className="space-y-2">
        {items.map((item) => {
          const active = currentPage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`group flex w-full items-center gap-3 border px-3 py-3 text-left transition ${
                active
                  ? 'border-crimson bg-burgundy/60 text-ivory shadow-glow'
                  : 'border-brass/15 bg-black/10 text-paper/75 hover:-translate-y-0.5 hover:border-brass/50 hover:bg-walnut/70 hover:text-ivory'
              }`}
            >
              <span className="font-mono text-xs text-brass">[{item.code}]</span>
              <span className="font-display tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-8 border border-dashed border-brass/30 p-3 text-xs text-paper/60">
        CONFIDENTIAL ROUTING CABINET<br />No cloud sync. Local evidence only.
      </div>
    </aside>
  );
}

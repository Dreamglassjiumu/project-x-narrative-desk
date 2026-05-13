import type { PageKey } from '../../data';

const items: Array<{ key: PageKey; label: string; code: string }> = [
  { key: 'dashboard', label: '案件总览', code: '00' },
  { key: 'factions', label: '帮派档案', code: '09' },
  { key: 'districts', label: '区域与地点', code: '22' },
  { key: 'characters', label: '角色卷宗', code: '47' },
  { key: 'storylines', label: '剧情线', code: '61' },
  { key: 'design-assets', label: '设计资料', code: 'DA' },
  { key: 'pitch', label: 'Pitch 写作台', code: 'PX' },
  { key: 'library', label: '本地资料库', code: 'EV' },
  { key: 'intake', label: '证物接收台', code: 'IN' },
];

export function Sidebar({ currentPage, onNavigate }: { currentPage: PageKey; onNavigate: (page: PageKey) => void }) {
  return (
    <aside className="w-full border-b border-brass/20 bg-espresso/95 p-4 shadow-dossier lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="mb-8 border border-brass/30 bg-walnut/60 p-4">
        <p className="type-label text-brass">SAN LIBRE PD ARCHIVE</p>
        <h1 className="font-display text-2xl text-ivory">Project：X</h1>
        <p className="mt-1 text-sm text-paper/70">叙事资料库</p>
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
        CONFIDENTIAL ROUTING CABINET<br />本地证物库 · 不进行云同步
      </div>
    </aside>
  );
}

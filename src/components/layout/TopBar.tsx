import type { PageKey } from '../../data';
import { SearchBox } from './SearchBox';

const titleMap: Record<PageKey, string> = {
  dashboard: 'Dashboard / 案件总览',
  factions: 'Factions / 帮派档案',
  districts: 'Districts & POI / 区域与地点',
  characters: 'Characters / 角色卷宗',
  storylines: 'Storylines / 剧本线索',
  pitch: 'Pitch Desk / 案件提案桌',
  library: 'Local Library / 本地证物柜',
};

export function TopBar({ page, query, onQueryChange, apiOnline }: { page: PageKey; query: string; onQueryChange: (value: string) => void; apiOnline: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-brass/20 bg-espresso/90 p-4 backdrop-blur-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="type-label text-crimson">CASE FILE // CLASSIFIED WORKROOM</p>
          <h2 className="font-display text-3xl text-ivory">{titleMap[page]}</h2>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchBox value={query} onChange={onQueryChange} />
          <div className="border border-teal/40 bg-police/30 px-3 py-2 font-mono text-xs text-paper/75">
            {apiOnline ? 'LOCAL JSON SYNC READY · SYSTEM: LOCAL ONLY' : 'LOCAL API OFFLINE · READ ONLY'}
          </div>
        </div>
      </div>
    </header>
  );
}

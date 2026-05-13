import type { PageKey } from '../../data';
import { SearchBox } from './SearchBox';
import { zh } from '../../i18n/zhCN';

const titleMap: Record<PageKey, string> = {
  dashboard: '案件总览',
  factions: '帮派档案',
  districts: '区域与地点',
  characters: '角色卷宗',
  storylines: '剧情线',
  'design-assets': '设计资料',
  pitch: 'Pitch 写作台',
  library: '本地资料库',
  intake: '证物接收台',
};

export function TopBar({ page, query, onQueryChange, apiOnline }: { page: PageKey; query: string; onQueryChange: (value: string) => void; apiOnline: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-brass/20 bg-espresso/90 p-4 backdrop-blur-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="type-label text-crimson">CASE FILE</p>
          <h2 className="font-display text-3xl text-ivory">{titleMap[page]}</h2>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchBox value={query} onChange={onQueryChange} />
          <div className="border border-teal/40 bg-police/30 px-3 py-2 font-mono text-xs text-paper/75">
            {apiOnline ? zh.statusLine.online : zh.statusLine.offline}
          </div>
        </div>
      </div>
    </header>
  );
}

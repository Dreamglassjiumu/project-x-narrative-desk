import { allAssets, characters, districts, factions, pois, storylines, type PageKey } from '../data';
import { AssetCard } from '../components/cards/AssetCard';

export function Dashboard({ onSelectPage }: { onSelectPage: (page: PageKey) => void }) {
  const secretCount = allAssets.filter((asset) => asset.spoilerLevel === 'secret').length;
  const stats = [
    ['Faction Files', factions.length, 'factions'],
    ['District / POI', districts.length + pois.length, 'districts'],
    ['Character Dossiers', characters.length, 'characters'],
    ['Story Threads', storylines.length, 'storylines'],
  ] as const;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden border border-brass/30 bg-[linear-gradient(120deg,rgba(74,22,26,.88),rgba(55,32,22,.82)),url('/noise.svg')] p-6 shadow-dossier">
        <p className="type-label text-brass">CONFIDENTIAL · SAN LIBRE CASE WALL</p>
        <h2 className="mt-2 max-w-4xl font-display text-4xl text-ivory lg:text-6xl">Project：X Narrative Desk</h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-paper/80">复古美国黑帮档案柜、旧警局案件墙与文案 pitch 工作台的混合系统。所有资料暂存于本地 TypeScript 数据与浏览器草稿。</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => onSelectPage('pitch')} className="evidence-button">打开 Pitch Desk</button>
          <button onClick={() => onSelectPage('library')} className="evidence-button bg-police/70">查看 Evidence Locker</button>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        {stats.map(([label, value, page]) => (
          <button key={label} onClick={() => onSelectPage(page)} className="border border-brass/30 bg-espresso/70 p-4 text-left transition hover:-translate-y-1 hover:bg-walnut/75">
            <p className="type-label text-crimson">ARCHIVE COUNT</p>
            <p className="mt-2 font-display text-4xl text-brass">{value}</p>
            <p className="text-paper/75">{label}</p>
          </button>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          {allAssets.slice(0, 4).map((asset) => <AssetCard key={asset.id} asset={asset} onSelect={() => onSelectPage(asset.category === 'Faction' ? 'factions' : asset.category === 'Character' ? 'characters' : asset.category === 'Storyline' ? 'storylines' : 'districts')} />)}
        </div>
        <aside className="border border-crimson/40 bg-burgundy/45 p-5 shadow-dossier">
          <p className="type-label text-crimson">RISK STRIP</p>
          <h3 className="font-display text-2xl text-ivory">{secretCount} Classified Records</h3>
          <p className="mt-3 text-paper/70">Pitch 中出现 secret 资料时，右栏会展示 CLASSIFIED 与 doNotRevealYet 提醒，避免提前泄露。</p>
          <div className="mt-5 border border-dashed border-brass/40 p-3 font-mono text-xs text-paper/60">RED THREAD BOARD READY · AUTOSAVE WATCHING</div>
        </aside>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { AnyAsset } from '../data';
import { AssetCard } from '../components/cards/AssetCard';
import { PitchEditor } from '../components/pitch/PitchEditor';
import { PitchInsightPanel } from '../components/pitch/PitchInsightPanel';
import { defaultPitchDraft, PITCH_STORAGE_KEY, serializePitchText, type PitchDraft } from '../utils/pitch';
import { detectAssetMentions, searchAssets } from '../utils/search';
import { SearchBox } from '../components/layout/SearchBox';

const loadDraft = (): PitchDraft => {
  try {
    const raw = localStorage.getItem(PITCH_STORAGE_KEY);
    return raw ? { ...defaultPitchDraft, ...JSON.parse(raw) } : defaultPitchDraft;
  } catch {
    return defaultPitchDraft;
  }
};

export function PitchDesk({ assets }: { assets: AnyAsset[] }) {
  const [draft, setDraft] = useState<PitchDraft>(loadDraft);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => searchAssets(assets, query).slice(0, 8), [assets, query]);
  const detected = useMemo(() => detectAssetMentions(assets, serializePitchText(draft)), [assets, draft]);

  useEffect(() => {
    localStorage.setItem(PITCH_STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  return (
    <div className="grid gap-5 2xl:grid-cols-[320px_minmax(0,1fr)_380px]">
      <aside className="border border-brass/25 bg-walnut/45 p-4 shadow-dossier">
        <p className="type-label text-brass">FILE CABINET INDEX</p>
        <h2 className="mb-4 font-display text-2xl text-ivory">资料索引</h2>
        <SearchBox value={query} onChange={setQuery} placeholder="在写 pitch 时查资料" />
        <div className="mt-4 space-y-3">
          {filtered.map((asset) => <AssetCard key={asset.id} asset={asset} onSelect={() => setQuery(asset.name)} />)}
          {filtered.length === 0 ? <p className="border border-dashed border-brass/30 p-3 text-sm text-paper/60">本地 data JSON 暂无匹配资料。</p> : null}
        </div>
      </aside>
      <PitchEditor draft={draft} onChange={setDraft} />
      <PitchInsightPanel detected={detected} />
    </div>
  );
}

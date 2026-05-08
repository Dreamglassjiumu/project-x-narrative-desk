import { useMemo, useState } from 'react';
import type { AnyAsset } from '../data';
import { AssetCard } from '../components/cards/AssetCard';
import { DetailPanel } from '../components/detail/DetailPanel';
import { searchAssets } from '../utils/search';

export function ArchivePage({ assets, query, eyebrow, title }: { assets: AnyAsset[]; query: string; eyebrow: string; title: string }) {
  const filtered = useMemo(() => searchAssets(assets, query), [assets, query]);
  const [selectedId, setSelectedId] = useState<string | undefined>(filtered[0]?.id);
  const selected = filtered.find((asset) => asset.id === selectedId) ?? filtered[0];

  return (
    <div>
      <div className="mb-5 border border-brass/25 bg-walnut/40 p-4">
        <p className="type-label text-brass">{eyebrow}</p>
        <h2 className="font-display text-3xl text-ivory">{title}</h2>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((asset) => <AssetCard key={asset.id} asset={asset} active={selected?.id === asset.id} onSelect={() => setSelectedId(asset.id)} />)}
        </div>
        <DetailPanel asset={selected} />
      </div>
    </div>
  );
}

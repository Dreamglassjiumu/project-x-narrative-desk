import type { AnyAsset } from '../../data';
import { ClassifiedBadge } from '../ui/ClassifiedBadge';
import { StatusStamp } from '../ui/StatusStamp';

export function AssetCard({ asset, active, onSelect }: { asset: AnyAsset; active?: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`case-card w-full text-left ${active ? 'ring-2 ring-crimson ring-offset-2 ring-offset-espresso' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-label text-sm text-crimson">{asset.category} / {asset.id}</p>
          <h3 className="mt-1 font-display text-xl text-espresso">{asset.name}</h3>
          <p className="text-sm text-walnut/70">{asset.chineseName} · {asset.englishName}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusStamp status={asset.status} />
          <ClassifiedBadge level={asset.spoilerLevel} />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-espresso/80">{asset.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {asset.tags.map((tag) => <span key={tag} className="tag-label">{tag}</span>)}
      </div>
    </button>
  );
}

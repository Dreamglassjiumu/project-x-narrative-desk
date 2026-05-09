import type { AnyAsset } from '../../data';
import type { UploadedFileRecord } from '../../utils/api';
import { getCompleteness } from '../../utils/completeness';
import { CompletenessBadge } from '../intake/CompletenessBadge';
import { ClassifiedBadge } from '../ui/ClassifiedBadge';
import { StatusStamp } from '../ui/StatusStamp';

export function AssetCard({ asset, active, files = [], onSelect }: { asset: AnyAsset; active?: boolean; files?: UploadedFileRecord[]; onSelect: () => void }) {
  const completeness = getCompleteness(asset, files);
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
          <CompletenessBadge result={completeness} />
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

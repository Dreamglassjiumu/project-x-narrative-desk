import type { AnyAsset } from '../../data';
import { assetTypeLabels, displayAssetName } from '../../utils/assetHelpers';

export function RelatedAssetList({ related, onOpen }: { related: Array<{ asset: AnyAsset; type: keyof typeof assetTypeLabels }>; onOpen?: (asset: AnyAsset) => void }) {
  if (!related.length) return <p className="text-sm text-walnut/60">No linked records.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {related.map(({ asset, type }) => (
        <button key={asset.id} onClick={() => onOpen?.(asset)} className="tag-label hover:border-crimson hover:text-crimson" title={asset.id}>
          {assetTypeLabels[type]} · {displayAssetName(asset)}
        </button>
      ))}
    </div>
  );
}

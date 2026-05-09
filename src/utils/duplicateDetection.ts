import type { AnyAsset } from '../data';
import { assetTypeFor } from './assetHelpers';

export interface DuplicateHit { asset: AnyAsset; type: string; strength: 'strong' | 'possible'; matchedTerm: string }
const terms = (asset: Partial<AnyAsset>) => [asset.name, asset.chineseName, asset.englishName, ...(asset.aliases ?? [])].map((x) => String(x ?? '').trim()).filter(Boolean);
const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
const compact = (value: string) => normalize(value).replace(/[^a-z0-9\u4e00-\u9fff]/gi, '');

export function detectDuplicates(draft: Partial<AnyAsset>, existing: AnyAsset[], currentId?: string): DuplicateHit[] {
  const draftTerms = terms(draft);
  if (!draftTerms.length) return [];
  const hits: DuplicateHit[] = [];
  for (const asset of existing) {
    if (asset.id === currentId) continue;
    const assetTerms = terms(asset);
    let best: DuplicateHit | undefined;
    for (const left of draftTerms) for (const right of assetTerms) {
      const l = normalize(left), r = normalize(right), lc = compact(left), rc = compact(right);
      if (l && r && l === r) best = { asset, type: assetTypeFor(asset), strength: 'strong', matchedTerm: right };
      else if (lc.length > 2 && rc.length > 2 && (lc.includes(rc) || rc.includes(lc))) best ??= { asset, type: assetTypeFor(asset), strength: 'possible', matchedTerm: right };
    }
    if (best) hits.push(best);
  }
  return hits.slice(0, 5);
}

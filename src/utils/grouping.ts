import type { AnyAsset } from '../data';
import type { AssetType } from './assetHelpers';

export type GroupByMode = 'none' | 'characterType' | 'factionCategory' | 'category' | 'districtId' | 'storylineType';
export const groupOptionsForType = (type: AssetType): Array<{ value: GroupByMode; label: string }> => {
  if (type === 'characters') return [{ value: 'none', label: 'No grouping' }, { value: 'characterType', label: 'characterType' }];
  if (type === 'factions') return [{ value: 'none', label: 'No grouping' }, { value: 'factionCategory', label: 'factionCategory' }];
  if (type === 'districts' || type === 'pois') return [{ value: 'none', label: 'No grouping' }, { value: 'category', label: 'Districts / POIs' }, { value: 'districtId', label: 'POIs by District' }];
  return [{ value: 'none', label: 'No grouping' }, { value: 'storylineType', label: 'storylineType' }];
};
export const groupAssets = (assets: AnyAsset[], mode: GroupByMode) => {
  if (mode === 'none') return [{ key: 'all', label: 'All Dossiers', assets }];
  const groups = new Map<string, AnyAsset[]>();
  for (const asset of assets) {
    let key = 'Unfiled';
    if (mode === 'characterType' && 'characterType' in asset) key = asset.characterType || 'other';
    if (mode === 'factionCategory' && 'factionCategory' in asset) key = asset.factionCategory || 'other';
    if (mode === 'storylineType' && 'storylineType' in asset) key = asset.storylineType || 'side';
    if (mode === 'category') key = asset.category === 'POI' || 'poiTier' in asset ? 'POIs' : 'Districts';
    if (mode === 'districtId') key = 'districtId' in asset ? (asset.districtId || 'POIs without district') : 'Districts';
    groups.set(key, [...(groups.get(key) ?? []), asset]);
  }
  return [...groups.entries()].map(([key, value]) => ({ key, label: key.replace(/_/g, ' '), assets: value }));
};

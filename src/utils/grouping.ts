import type { AnyAsset } from '../data';
import type { AssetType } from './assetHelpers';

export type GroupByMode = 'none' | 'characterType' | 'factionCategory' | 'category' | 'districtId' | 'storylineType';
export const groupOptionsForType = (type: AssetType): Array<{ value: GroupByMode; label: string }> => {
  if (type === 'characters') return [{ value: 'none', label: '不分组' }, { value: 'characterType', label: '角色类型' }];
  if (type === 'factions') return [{ value: 'none', label: '不分组' }, { value: 'factionCategory', label: '帮派类别' }];
  if (type === 'districts' || type === 'pois') return [{ value: 'none', label: '不分组' }, { value: 'category', label: '区域 / 地点' }, { value: 'districtId', label: '按区域查看地点' }];
  return [{ value: 'none', label: '不分组' }, { value: 'storylineType', label: '剧情线类型' }];
};
export const groupAssets = (assets: AnyAsset[], mode: GroupByMode) => {
  if (mode === 'none') return [{ key: 'all', label: '全部档案', assets }];
  const groups = new Map<string, AnyAsset[]>();
  for (const asset of assets) {
    let key = '未归档';
    if (mode === 'characterType' && 'characterType' in asset) key = asset.characterType || 'other';
    if (mode === 'factionCategory' && 'factionCategory' in asset) key = asset.factionCategory || 'other';
    if (mode === 'storylineType' && 'storylineType' in asset) key = asset.storylineType || 'side';
    if (mode === 'category') key = asset.category === 'POI' || 'poiTier' in asset ? '地点' : '区域';
    if (mode === 'districtId') key = 'districtId' in asset ? (asset.districtId || '未绑定区域的地点') : '区域';
    groups.set(key, [...(groups.get(key) ?? []), asset]);
  }
  return [...groups.entries()].map(([key, value]) => ({ key, label: key.replace(/_/g, ' '), assets: value }));
};

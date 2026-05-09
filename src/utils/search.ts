import type { AnyAsset } from '../data';

export interface AssetFilters {
  category?: string;
  status?: string;
  spoilerLevel?: string;
  tag?: string;
  relatedFactionId?: string;
  relatedDistrictId?: string;
  relatedStorylineId?: string;
}

export const getSearchTerms = (asset: AnyAsset): string[] =>
  [asset.name, asset.chineseName, asset.englishName, ...asset.aliases]
    .filter(Boolean)
    .map((term) => term.toLowerCase());

export const getAssetHitTypes = (asset: AnyAsset, query: string): string[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const tests: Array<[string, unknown]> = [
    ['name', asset.name], ['chineseName', asset.chineseName], ['englishName', asset.englishName], ['aliases', asset.aliases], ['tags', asset.tags], ['summary', asset.summary],
  ];
  return tests.filter(([, value]) => (Array.isArray(value) ? value.join(' ') : String(value ?? '')).toLowerCase().includes(normalized)).map(([label]) => label);
};

export const searchAssets = (assets: AnyAsset[], query: string, filters: AssetFilters = {}): AnyAsset[] => {
  const normalized = query.trim().toLowerCase();
  return assets.filter((asset) => {
    const haystack = [asset.name, asset.chineseName, asset.englishName, asset.summary, ...asset.aliases, ...asset.tags].join(' ').toLowerCase();
    const matchesQuery = !normalized || haystack.includes(normalized);
    const matchesFilters = (!filters.category || asset.category === filters.category)
      && (!filters.status || asset.status === filters.status)
      && (!filters.spoilerLevel || asset.spoilerLevel === filters.spoilerLevel)
      && (!filters.tag || asset.tags.includes(filters.tag))
      && (!filters.relatedFactionId || asset.relatedFactionIds.includes(filters.relatedFactionId))
      && (!filters.relatedDistrictId || asset.relatedDistrictIds.includes(filters.relatedDistrictId))
      && (!filters.relatedStorylineId || asset.relatedStorylineIds.includes(filters.relatedStorylineId));
    return matchesQuery && matchesFilters;
  });
};

const matchesTerm = (normalizedText: string, term: string): boolean => {
  if (term.length > 1) return normalizedText.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(normalizedText);
};

export const detectAssetMentions = (assets: AnyAsset[], text: string): AnyAsset[] => {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) return [];
  return assets.filter((asset) => getSearchTerms(asset).some((term) => term && matchesTerm(normalized, term)));
};

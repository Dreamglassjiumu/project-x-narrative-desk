import type { AnyAsset } from '../data';

export const getSearchTerms = (asset: AnyAsset): string[] =>
  [asset.name, asset.chineseName, asset.englishName, ...asset.aliases]
    .filter(Boolean)
    .map((term) => term.toLowerCase());

export const searchAssets = (assets: AnyAsset[], query: string): AnyAsset[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return assets;
  return assets.filter((asset) => {
    const haystack = [
      asset.name,
      asset.chineseName,
      asset.englishName,
      asset.summary,
      asset.details,
      asset.category,
      ...asset.aliases,
      ...asset.tags,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalized);
  });
};

export const detectAssetMentions = (assets: AnyAsset[], text: string): AnyAsset[] => {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) return [];

  return assets.filter((asset) =>
    getSearchTerms(asset).some((term) => term.length > 1 && normalized.includes(term)),
  );
};

import type { AnyAsset } from '../data';
import type { AssetBundle, UploadedFileRecord } from './api';

export type AssetType = 'factions' | 'districts' | 'pois' | 'characters' | 'storylines';

export const assetTypeLabels: Record<AssetType, string> = {
  factions: 'Faction',
  districts: 'District',
  pois: 'POI',
  characters: 'Character',
  storylines: 'Storyline',
};

export const assetTypeFor = (asset: AnyAsset): AssetType => {
  if ('characterType' in asset) return 'characters';
  if ('factionCategory' in asset) return 'factions';
  if ('poiTier' in asset) return 'pois';
  if ('storylineType' in asset) return 'storylines';
  return 'districts';
};

export const makeAssetIndex = (bundle: Pick<AssetBundle, AssetType>) => {
  const entries = (Object.keys(assetTypeLabels) as AssetType[]).flatMap((type) =>
    bundle[type].map((asset) => [asset.id, { asset, type }] as const),
  );
  return new Map(entries);
};

export const displayAssetName = (asset?: Pick<AnyAsset, 'name' | 'chineseName' | 'englishName'>) =>
  asset ? `${asset.name}${asset.chineseName ? ` / ${asset.chineseName}` : ''}` : 'Unknown dossier';

const array = (value: unknown): string[] => Array.isArray(value) ? value.map(String).filter(Boolean) : [];

export const normalizeAssetPayload = (type: AssetType, value: Partial<AnyAsset>): AnyAsset => {
  const base = {
    id: value.id || '',
    name: value.name || 'Untitled Dossier',
    chineseName: value.chineseName || '',
    englishName: value.englishName || value.name || '',
    aliases: array(value.aliases),
    category: value.category || assetTypeLabels[type],
    summary: value.summary || '',
    details: value.details || '',
    tags: array(value.tags),
    status: value.status || 'draft',
    spoilerLevel: value.spoilerLevel || 'internal',
    relatedFactionIds: array(value.relatedFactionIds),
    relatedDistrictIds: array(value.relatedDistrictIds),
    relatedPoiIds: array(value.relatedPoiIds),
    relatedCharacterIds: array(value.relatedCharacterIds),
    relatedStorylineIds: array(value.relatedStorylineIds),
    narrativeConstraints: array(value.narrativeConstraints),
    doNotRevealYet: array(value.doNotRevealYet),
    sourceNotes: array(value.sourceNotes),
  };

  if (type === 'characters') return { ...base, characterType: 'story_npc', gender: '', age: '', nationality: '', ethnicity: '', occupation: '', weapon: '', attribute: '', playableScripts: [], characterArc: '', currentTimelineStatus: '', ...(value as object) } as AnyAsset;
  if (type === 'factions') return { ...base, factionCategory: '', culturalRoot: [], territoryDistrictIds: [], headquartersPoiIds: [], coreBusiness: [], allies: [], enemies: [], visualKeywords: [], missionTypes: [], ...(value as object) } as AnyAsset;
  if (type === 'districts') return { ...base, realWorldReference: '', atmosphere: [], dominantFactions: [], keyPoiIds: [], storyUsage: [], gameplayUsage: [], districtStatus: '', ...(value as object) } as AnyAsset;
  if (type === 'pois') return { ...base, districtId: '', poiTier: 'landmark', realWorldReference: '', addressReference: '', gameplayUsage: [], storyUsage: [], ...(value as object) } as AnyAsset;
  return { ...base, storylineType: 'side', act: '', relatedPlayableCharacters: [], relatedBosses: [], mainConflict: '', playerGoal: '', endingState: '', timelinePlacement: '', pitchStatus: 'under_review', ...(value as object) } as AnyAsset;
};

export const linkedFilesForAsset = (files: UploadedFileRecord[], assetId: string) => files.filter((file) => file.linkedAssetIds?.includes(assetId));

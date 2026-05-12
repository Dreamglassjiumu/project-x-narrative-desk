import type { AnyAsset } from '../../data';
import type { AssetType } from '../../utils/assetHelpers';
import { normalizeAssetPayload } from '../../utils/assetHelpers';

export type DossierTemplateId = 'faction' | 'district' | 'poi' | 'playable_hero' | 'boss' | 'story_npc' | 'storyline';

export interface DossierTemplate {
  id: DossierTemplateId;
  englishName: string;
  chineseName: string;
  description: string;
  type: AssetType;
  stamp: string;
  defaults: Partial<AnyAsset>;
  preferredFields: string[];
}

export const dossierTemplates: DossierTemplate[] = [
  { id: 'faction', englishName: '帮派', chineseName: '帮派', description: '帮派势力档案。', type: 'factions', stamp: 'GANG LEDGER', defaults: { category: 'Faction', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['factionCategory', 'culturalRoot', 'territoryDistrictIds', 'coreBusiness', 'missionTypes'] },
  { id: 'district', englishName: '区域', chineseName: '区域', description: '城市区域档案。', type: 'districts', stamp: 'CITY DRAWER', defaults: { category: 'District', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['realWorldReference', 'atmosphere', 'dominantFactions', 'keyPoiIds', 'storyUsage'] },
  { id: 'poi', englishName: '地点', chineseName: '地点', description: '地点档案。', type: 'pois', stamp: 'LOCATION PIN', defaults: { category: 'POI', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['districtId', 'poiTier', 'realWorldReference', 'addressReference', 'storyUsage', 'gameplayUsage'] },
  { id: 'playable_hero', englishName: '可操控英雄', chineseName: '可操控英雄', description: '玩家角色档案。', type: 'characters', stamp: 'MUGSHOT', defaults: { category: 'Character', characterType: 'playable_hero', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['characterType', 'occupation', 'factionId', 'districtId', 'weapon', 'attribute', 'playableScripts', 'characterArc'] },
  { id: 'boss', englishName: 'Boss', chineseName: 'Boss', description: '关键反派档案。', type: 'characters', stamp: 'CLASSIFIED', defaults: { category: 'Character', characterType: 'boss', status: 'draft', spoilerLevel: 'secret' }, preferredFields: ['characterType', 'occupation', 'factionId', 'districtId', 'weapon', 'characterArc', 'currentTimelineStatus'] },
  { id: 'story_npc', englishName: '剧情人物', chineseName: '剧情人物', description: '剧情人物档案。', type: 'characters', stamp: 'WITNESS', defaults: { category: 'Character', characterType: 'story_npc', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['characterType', 'occupation', 'factionId', 'districtId', 'relatedStorylineIds', 'characterArc'] },
  { id: 'storyline', englishName: '剧情线', chineseName: '剧情线', description: '剧情线档案。', type: 'storylines', stamp: 'THREAD', defaults: { category: 'Storyline', status: 'draft', spoilerLevel: 'secret' }, preferredFields: ['storylineType', 'act', 'mainConflict', 'playerGoal', 'relatedCharacterIds', 'timelinePlacement'] },
];

export const templatesForType = (_type?: AssetType) => dossierTemplates;
export const templateById = (id: DossierTemplateId) => dossierTemplates.find((template) => template.id === id) ?? dossierTemplates[0];
export const createAssetFromTemplate = (id: DossierTemplateId, extra: Partial<AnyAsset> = {}) => {
  const template = templateById(id);
  return normalizeAssetPayload(template.type, { ...template.defaults, ...extra });
};

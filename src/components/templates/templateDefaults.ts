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
  { id: 'faction', englishName: 'Faction', chineseName: '帮派势力', description: 'Crew, family, cartel, syndicate, or street outfit with turf and business lines.', type: 'factions', stamp: 'GANG LEDGER', defaults: { category: 'Faction', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['factionCategory', 'culturalRoot', 'territoryDistrictIds', 'coreBusiness', 'missionTypes'] },
  { id: 'district', englishName: 'District', chineseName: '城市区域', description: 'Neighborhood case folder for atmosphere, turf pressure, and city-map references.', type: 'districts', stamp: 'CITY DRAWER', defaults: { category: 'District', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['realWorldReference', 'atmosphere', 'dominantFactions', 'keyPoiIds', 'storyUsage'] },
  { id: 'poi', englishName: 'POI', chineseName: '点位', description: 'Landmark, safehouse, business, hideout, or street-corner location dossier.', type: 'pois', stamp: 'LOCATION PIN', defaults: { category: 'POI', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['districtId', 'poiTier', 'realWorldReference', 'addressReference', 'storyUsage', 'gameplayUsage'] },
  { id: 'playable_hero', englishName: 'Playable Hero', chineseName: '可操控英雄', description: 'Player-facing protagonist dossier with gameplay identity and narrative arc.', type: 'characters', stamp: 'MUGSHOT', defaults: { category: 'Character', characterType: 'playable_hero', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['characterType', 'occupation', 'factionId', 'districtId', 'weapon', 'attribute', 'playableScripts', 'characterArc'] },
  { id: 'boss', englishName: 'Boss', chineseName: 'Boss', description: 'Classified antagonist, encounter target, or faction power node.', type: 'characters', stamp: 'CLASSIFIED', defaults: { category: 'Character', characterType: 'boss', status: 'draft', spoilerLevel: 'secret' }, preferredFields: ['characterType', 'occupation', 'factionId', 'districtId', 'weapon', 'characterArc', 'currentTimelineStatus'] },
  { id: 'story_npc', englishName: 'Story NPC', chineseName: '剧情人物', description: 'Script-facing informant, ally, witness, victim, fixer, or civilian contact.', type: 'characters', stamp: 'WITNESS', defaults: { category: 'Character', characterType: 'story_npc', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['characterType', 'occupation', 'factionId', 'districtId', 'relatedStorylineIds', 'characterArc'] },
  { id: 'storyline', englishName: 'Storyline', chineseName: '剧情线', description: 'Main case, side story, character arc, faction thread, or district incident.', type: 'storylines', stamp: 'THREAD', defaults: { category: 'Storyline', status: 'draft', spoilerLevel: 'secret' }, preferredFields: ['storylineType', 'act', 'mainConflict', 'playerGoal', 'relatedCharacterIds', 'timelinePlacement'] },
];

export const templatesForType = (_type?: AssetType) => dossierTemplates;
export const templateById = (id: DossierTemplateId) => dossierTemplates.find((template) => template.id === id) ?? dossierTemplates[0];
export const createAssetFromTemplate = (id: DossierTemplateId, extra: Partial<AnyAsset> = {}) => {
  const template = templateById(id);
  return normalizeAssetPayload(template.type, { ...template.defaults, ...extra });
};

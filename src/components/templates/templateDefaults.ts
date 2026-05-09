import type { AnyAsset } from '../../data';
import type { AssetType } from '../../utils/assetHelpers';
import { normalizeAssetPayload } from '../../utils/assetHelpers';

export type DossierTemplateId = 'faction' | 'district' | 'poi' | 'playable_hero' | 'boss' | 'story_npc' | 'storyline';

export interface DossierTemplate {
  id: DossierTemplateId;
  title: string;
  subtitle: string;
  type: AssetType;
  stamp: string;
  defaults: Partial<AnyAsset>;
  preferredFields: string[];
}

export const dossierTemplates: DossierTemplate[] = [
  { id: 'faction', title: 'Faction / 帮派势力', subtitle: 'Crew, family, cartel, syndicate, street outfit.', type: 'factions', stamp: 'GANG LEDGER', defaults: { category: 'Faction', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['factionCategory', 'culturalRoot', 'territoryDistrictIds', 'coreBusiness', 'missionTypes'] },
  { id: 'district', title: 'District / 城市区域', subtitle: 'Neighborhood folder, atmosphere, turf, map reference.', type: 'districts', stamp: 'CITY DRAWER', defaults: { category: 'District', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['realWorldReference', 'atmosphere', 'dominantFactions', 'keyPoiIds', 'storyUsage'] },
  { id: 'poi', title: 'POI / 点位', subtitle: 'Landmark, safehouse, business, hideout, street corner.', type: 'pois', stamp: 'LOCATION PIN', defaults: { category: 'POI', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['districtId', 'poiTier', 'realWorldReference', 'addressReference', 'storyUsage', 'gameplayUsage'] },
  { id: 'playable_hero', title: 'Playable Hero / 可操控英雄', subtitle: 'Player-facing protagonist dossier and gameplay lead.', type: 'characters', stamp: 'MUGSHOT', defaults: { category: 'Character', characterType: 'playable_hero', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['characterType', 'occupation', 'factionId', 'districtId', 'weapon', 'attribute', 'playableScripts', 'characterArc'] },
  { id: 'boss', title: 'Boss / Boss', subtitle: 'Classified antagonist, encounter target, faction power node.', type: 'characters', stamp: 'CLASSIFIED', defaults: { category: 'Character', characterType: 'boss', status: 'draft', spoilerLevel: 'secret' }, preferredFields: ['characterType', 'occupation', 'factionId', 'districtId', 'weapon', 'characterArc', 'currentTimelineStatus'] },
  { id: 'story_npc', title: 'Story NPC / 剧情人物', subtitle: 'Script-facing informant, ally, witness, victim, fixer.', type: 'characters', stamp: 'WITNESS', defaults: { category: 'Character', characterType: 'story_npc', status: 'draft', spoilerLevel: 'internal' }, preferredFields: ['characterType', 'occupation', 'factionId', 'districtId', 'relatedStorylineIds', 'characterArc'] },
  { id: 'storyline', title: 'Storyline / 剧情线', subtitle: 'Main case, side story, character arc, faction or district thread.', type: 'storylines', stamp: 'THREAD', defaults: { category: 'Storyline', status: 'draft', spoilerLevel: 'secret' }, preferredFields: ['storylineType', 'act', 'mainConflict', 'playerGoal', 'relatedCharacterIds', 'timelinePlacement'] },
];

export const templatesForType = (type?: AssetType) => dossierTemplates.filter((template) => !type || template.type === type || (type === 'districts' && template.type === 'pois'));
export const templateById = (id: DossierTemplateId) => dossierTemplates.find((template) => template.id === id) ?? dossierTemplates[0];
export const createAssetFromTemplate = (id: DossierTemplateId, extra: Partial<AnyAsset> = {}) => {
  const template = templateById(id);
  return normalizeAssetPayload(template.type, { ...template.defaults, ...extra });
};

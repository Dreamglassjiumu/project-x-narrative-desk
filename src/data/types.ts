export type AssetStatus = 'canon' | 'draft' | 'deprecated' | 'under_review';
export type SpoilerLevel = 'public' | 'internal' | 'secret';

export interface NarrativeAsset {
  id: string;
  name: string;
  chineseName: string;
  englishName: string;
  aliases: string[];
  category: string;
  summary: string;
  details: string;
  tags: string[];
  status: AssetStatus;
  spoilerLevel: SpoilerLevel;
  relatedFactionIds: string[];
  relatedDistrictIds: string[];
  relatedPoiIds: string[];
  relatedCharacterIds: string[];
  relatedStorylineIds: string[];
  narrativeConstraints: string[];
  doNotRevealYet: string[];
  sourceNotes: string[];
}

export type CharacterType =
  | 'protagonist'
  | 'playable_hero'
  | 'boss'
  | 'story_npc'
  | 'faction_member'
  | 'law_enforcement'
  | 'civilian';

export interface Character extends NarrativeAsset {
  characterType: CharacterType;
  gender: string;
  age: string;
  nationality: string;
  ethnicity: string;
  occupation: string;
  factionId?: string;
  districtId?: string;
  weapon: string;
  attribute: string;
  playableScripts: string[];
  characterArc: string;
  currentTimelineStatus: string;
}

export interface Faction extends NarrativeAsset {
  factionCategory: string;
  culturalRoot: string;
  territoryDistrictIds: string[];
  headquartersPoiIds: string[];
  coreBusiness: string[];
  allies: string[];
  enemies: string[];
  visualKeywords: string[];
  missionTypes: string[];
}

export interface District extends NarrativeAsset {
  realWorldReference: string;
  atmosphere: string[];
  dominantFactions: string[];
  keyPoiIds?: string[];
  storyUsage?: string[];
  gameplayUsage?: string[];
  districtStatus?: string;
}

export interface Poi extends NarrativeAsset {
  districtId: string;
  poiTier: 'landmark' | 'safehouse' | 'street' | 'business' | 'hideout';
  realWorldReference: string;
  addressReference: string;
  gameplayUsage: string[];
  storyUsage: string[];
}

export interface Storyline extends NarrativeAsset {
  storylineType: 'main' | 'side' | 'character' | 'district' | 'faction' | 'prologue' | 'event';
  timeline?: string;
  act: string;
  relatedPlayableCharacters?: string[];
  relatedBosses?: string[];
  mainConflict?: string;
  playerGoal?: string;
  endingState?: string;
  timelinePlacement?: string;
  pitchStatus?: string;
}

export type AnyAsset = NarrativeAsset | Character | Faction | District | Poi | Storyline;

export type PageKey = 'dashboard' | 'factions' | 'districts' | 'characters' | 'storylines' | 'pitch' | 'library';

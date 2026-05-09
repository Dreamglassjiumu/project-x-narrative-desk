import type { AnyAsset } from '../data';
import type { UploadedFileRecord } from './api';

export type CompletenessStatus = 'complete' | 'needs_review' | 'incomplete';
export interface CompletenessResult { score: number; status: CompletenessStatus; missing: string[]; passed: number; total: number }

const hasText = (value: unknown) => typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
const hasArray = (value: unknown) => Array.isArray(value) && value.length > 0;
const hasAny = (...values: unknown[]) => values.some((value) => hasText(value) || hasArray(value));
const relationKeys = ['relatedFactionIds', 'relatedDistrictIds', 'relatedPoiIds', 'relatedCharacterIds', 'relatedStorylineIds'] as const;

export function getCompleteness(asset: AnyAsset, files: UploadedFileRecord[] = []): CompletenessResult {
  const checks: Array<[string, boolean]> = [
    ['name', hasText(asset.name)],
    ['summary', hasText(asset.summary)],
    ['details', hasText(asset.details)],
    ['tags', hasArray(asset.tags)],
    ['sourceNotes', hasArray(asset.sourceNotes)],
    ['at least one related dossier', relationKeys.some((key) => hasArray(asset[key]))],
    ['linked files', files.some((file) => file.linkedAssetIds?.includes(asset.id))],
  ];
  if ('factionCategory' in asset) checks.push(
    ['factionCategory', hasText(asset.factionCategory)],
    ['culturalRoot', hasAny(asset.culturalRoot)],
    ['territoryDistrictIds', hasArray(asset.territoryDistrictIds)],
    ['coreBusiness', hasArray(asset.coreBusiness)],
    ['missionTypes', hasArray(asset.missionTypes)],
  );
  if ('characterType' in asset) checks.push(
    ['characterType', hasText(asset.characterType)],
    ['occupation', hasText(asset.occupation)],
    ['factionId / districtId / relatedStorylineIds', hasAny(asset.factionId, asset.districtId, asset.relatedStorylineIds)],
    ['characterArc / currentTimelineStatus', hasAny(asset.characterArc, asset.currentTimelineStatus)],
  );
  if ('atmosphere' in asset && !('poiTier' in asset)) checks.push(
    ['realWorldReference', hasText(asset.realWorldReference)],
    ['atmosphere', hasArray(asset.atmosphere)],
    ['keyPoiIds / relatedPoiIds', hasAny(asset.keyPoiIds, asset.relatedPoiIds)],
    ['storyUsage', hasArray(asset.storyUsage)],
  );
  if ('poiTier' in asset) {
    const poi = asset as AnyAsset & { districtId?: string; poiTier?: string; storyUsage?: string[]; gameplayUsage?: string[] };
    checks.push(
      ['districtId', hasText(poi.districtId)],
      ['poiTier', hasText(poi.poiTier)],
      ['storyUsage / gameplayUsage', hasAny(poi.storyUsage, poi.gameplayUsage)],
    );
  }
  if ('storylineType' in asset) {
    const storyline = asset as AnyAsset & { storylineType?: string; mainConflict?: string; playerGoal?: string; timelinePlacement?: string };
    checks.push(
      ['storylineType', hasText(storyline.storylineType)],
      ['mainConflict', hasText(storyline.mainConflict)],
      ['playerGoal', hasText(storyline.playerGoal)],
      ['relatedCharacterIds', hasArray(asset.relatedCharacterIds)],
      ['timelinePlacement', hasText(storyline.timelinePlacement)],
    );
  }
  const passed = checks.filter(([, pass]) => pass).length;
  const total = checks.length || 1;
  const score = Math.round((passed / total) * 100);
  const status: CompletenessStatus = score >= 85 ? 'complete' : score >= 50 ? 'needs_review' : 'incomplete';
  return { score, status, missing: checks.filter(([, pass]) => !pass).map(([label]) => label), passed, total };
}

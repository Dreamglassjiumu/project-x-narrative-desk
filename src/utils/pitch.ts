import type { AnyAsset } from '../data';

export type PitchType = 'main' | 'side' | 'character' | 'district' | 'faction' | 'event' | 'prologue' | 'other';
export type PitchStatus = 'draft' | 'under_review' | 'canon';

export interface PitchDraft {
  id?: string;
  title: string;
  type: PitchType;
  status: PitchStatus;
  body: string;
  linkedCharacterIds: string[];
  linkedFactionIds: string[];
  linkedDistrictIds: string[];
  linkedPoiIds: string[];
  linkedStorylineIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedPitch extends PitchDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type LegacyPitchDraft = Partial<PitchDraft> & Record<string, unknown>;

export const PITCH_STORAGE_KEY = 'project-x-narrative-desk:pitch-draft';

export const pitchTypes: PitchType[] = ['main', 'side', 'character', 'district', 'faction', 'event', 'prologue', 'other'];
export const pitchStatuses: PitchStatus[] = ['draft', 'under_review', 'canon'];

export const defaultPitchDraft: PitchDraft = {
  title: 'Untitled Case Pitch',
  type: 'side',
  status: 'draft',
  body: '',
  linkedCharacterIds: [],
  linkedFactionIds: [],
  linkedDistrictIds: [],
  linkedPoiIds: [],
  linkedStorylineIds: [],
};

const legacyTypeMap: Record<string, PitchType> = {
  主线: 'main',
  支线: 'side',
  角色任务: 'character',
  区域任务: 'district',
  帮派任务: 'faction',
};

const oldFieldLabels: Array<[string, string]> = [
  ['logline', '一句话卖点'],
  ['background', '故事背景'],
  ['playerGoal', '玩家目标'],
  ['coreConflict', '核心冲突'],
  ['characters', '涉及角色'],
  ['districts', '涉及区域'],
  ['factions', '涉及帮派'],
  ['missionFlow', '任务流程'],
  ['keyScenes', '关键场景'],
  ['ending', '结局'],
  ['futureHooks', '后续钩子'],
  ['newLore', '新增设定'],
  ['possibleConflicts', '可能冲突点'],
];

const asStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const normalizeType = (value: unknown): PitchType => {
  if (typeof value !== 'string') return defaultPitchDraft.type;
  if (pitchTypes.includes(value as PitchType)) return value as PitchType;
  return legacyTypeMap[value] ?? defaultPitchDraft.type;
};

const normalizeStatus = (value: unknown): PitchStatus => {
  if (value === 'under_review' || value === 'canon') return value;
  return 'draft';
};

const mergeLegacyBody = (pitch: LegacyPitchDraft): string => {
  const body = typeof pitch.body === 'string' ? pitch.body.trim() : '';
  const legacySections = oldFieldLabels
    .map(([key, label]) => {
      const value = pitch[key];
      if (typeof value !== 'string' || !value.trim()) return undefined;
      return `## ${label}\n${value.trim()}`;
    })
    .filter(Boolean) as string[];
  return [body, ...legacySections].filter(Boolean).join('\n\n');
};

export const normalizePitchDraft = (value: unknown): PitchDraft => {
  const pitch = (value && typeof value === 'object' ? value : {}) as LegacyPitchDraft;
  return {
    id: typeof pitch.id === 'string' ? pitch.id : undefined,
    title: typeof pitch.title === 'string' && pitch.title.trim() ? pitch.title : defaultPitchDraft.title,
    type: normalizeType(pitch.type),
    status: normalizeStatus(pitch.status),
    body: mergeLegacyBody(pitch),
    linkedCharacterIds: asStringArray(pitch.linkedCharacterIds),
    linkedFactionIds: asStringArray(pitch.linkedFactionIds),
    linkedDistrictIds: asStringArray(pitch.linkedDistrictIds),
    linkedPoiIds: asStringArray(pitch.linkedPoiIds),
    linkedStorylineIds: asStringArray(pitch.linkedStorylineIds),
    createdAt: typeof pitch.createdAt === 'string' ? pitch.createdAt : undefined,
    updatedAt: typeof pitch.updatedAt === 'string' ? pitch.updatedAt : undefined,
  };
};

export const normalizeSavedPitch = (value: unknown): SavedPitch => {
  const draft = normalizePitchDraft(value);
  const now = new Date().toISOString();
  return {
    ...draft,
    id: draft.id ?? `legacy-${crypto.randomUUID()}`,
    createdAt: draft.createdAt ?? now,
    updatedAt: draft.updatedAt ?? draft.createdAt ?? now,
  };
};

export const serializePitchText = (draft: PitchDraft): string => [draft.title, draft.type, draft.status, draft.body].join('\n');

export const getPitchLinkedIds = (draft: PitchDraft): string[] => [
  ...draft.linkedCharacterIds,
  ...draft.linkedFactionIds,
  ...draft.linkedDistrictIds,
  ...draft.linkedPoiIds,
  ...draft.linkedStorylineIds,
];

export const getPitchLinkedAssets = (assets: AnyAsset[], draft: PitchDraft): AnyAsset[] => {
  const linkedIds = new Set(getPitchLinkedIds(draft));
  return assets.filter((asset) => linkedIds.has(asset.id));
};

export const exportPitchMarkdown = (draft: PitchDraft, assets: AnyAsset[] = []): string => {
  const assetNames = (ids: string[]) => ids.map((id) => assets.find((asset) => asset.id === id)?.name ?? id).join(', ') || '_None_';
  return [
    `# ${draft.title || 'Untitled Case Pitch'}`,
    '',
    `> Type: ${draft.type}`,
    `> Status: ${draft.status}`,
    '',
    '## Linked Characters',
    assetNames(draft.linkedCharacterIds),
    '',
    '## Linked Factions',
    assetNames(draft.linkedFactionIds),
    '',
    '## Linked Districts',
    assetNames(draft.linkedDistrictIds),
    '',
    '## Linked POIs',
    assetNames(draft.linkedPoiIds),
    '',
    '## Linked Storylines',
    assetNames(draft.linkedStorylineIds),
    '',
    '## Pitch Body',
    draft.body || '_未填写_',
    '',
  ].join('\n');
};

export const pitchOutlineTemplate = `# 一句话卖点

# 故事概要

# 主要出场人物

# 发生地点

# 玩家目标

# 核心冲突

# 任务流程

# 结局 / 后续钩子
`;

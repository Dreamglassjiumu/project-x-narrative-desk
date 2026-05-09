export type PitchType = '主线' | '支线' | '角色任务' | '区域任务' | '帮派任务';

export interface PitchDraft {
  id?: string;
  status?: 'draft' | 'under_review' | 'canon' | 'deprecated';
  createdAt?: string;
  updatedAt?: string;
  title: string;
  type: PitchType;
  logline: string;
  background: string;
  playerGoal: string;
  coreConflict: string;
  characters: string;
  districts: string;
  factions: string;
  missionFlow: string;
  keyScenes: string;
  ending: string;
  futureHooks: string;
  newLore: string;
  possibleConflicts: string;
}

export interface SavedPitch extends PitchDraft {
  id: string;
  status: 'draft' | 'under_review' | 'canon' | 'deprecated';
  createdAt: string;
  updatedAt: string;
}

export const PITCH_STORAGE_KEY = 'project-x-narrative-desk:pitch-draft';

export const defaultPitchDraft: PitchDraft = {
  title: 'Untitled Case Pitch',
  type: '支线',
  logline: '',
  background: '',
  playerGoal: '',
  coreConflict: '',
  characters: '',
  districts: '',
  factions: '',
  missionFlow: '',
  keyScenes: '',
  ending: '',
  futureHooks: '',
  newLore: '',
  possibleConflicts: '',
};

export const pitchFieldLabels: Array<{ key: keyof PitchDraft; label: string; multiline?: boolean }> = [
  { key: 'title', label: 'Pitch 标题' },
  { key: 'logline', label: '一句话卖点' },
  { key: 'background', label: '故事背景', multiline: true },
  { key: 'playerGoal', label: '玩家目标', multiline: true },
  { key: 'coreConflict', label: '核心冲突', multiline: true },
  { key: 'characters', label: '涉及角色', multiline: true },
  { key: 'districts', label: '涉及区域', multiline: true },
  { key: 'factions', label: '涉及帮派', multiline: true },
  { key: 'missionFlow', label: '任务流程', multiline: true },
  { key: 'keyScenes', label: '关键场景', multiline: true },
  { key: 'ending', label: '结局', multiline: true },
  { key: 'futureHooks', label: '后续钩子', multiline: true },
  { key: 'newLore', label: '新增设定', multiline: true },
  { key: 'possibleConflicts', label: '可能冲突点', multiline: true },
];

export const serializePitchText = (draft: PitchDraft): string =>
  [
    draft.title,
    draft.type,
    draft.logline,
    draft.background,
    draft.playerGoal,
    draft.coreConflict,
    draft.characters,
    draft.districts,
    draft.factions,
    draft.missionFlow,
    draft.keyScenes,
    draft.ending,
    draft.futureHooks,
    draft.newLore,
    draft.possibleConflicts,
  ].join('\n');

export const exportPitchMarkdown = (draft: PitchDraft): string => {
  const lines = [`# ${draft.title || 'Untitled Case Pitch'}`, '', `> Type: ${draft.type}`, ''];
  pitchFieldLabels
    .filter((field) => field.key !== 'title')
    .forEach((field) => {
      lines.push(`## ${field.label}`);
      lines.push(String(draft[field.key] || '_未填写_'));
      lines.push('');
    });
  return lines.join('\n');
};

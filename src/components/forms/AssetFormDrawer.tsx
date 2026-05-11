import { useEffect, useMemo, useState } from 'react';
import type { AnyAsset } from '../../data';
import type { DossierTemplateId } from '../templates/templateDefaults';
import { templateById } from '../templates/templateDefaults';
import { DuplicateWarning } from '../intake/DuplicateWarning';
import { statusLabel, spoilerLabel } from '../../i18n/zhCN';
import { detectDuplicates } from '../../utils/duplicateDetection';
import type { AssetBundle } from '../../utils/api';
import type { AssetType } from '../../utils/assetHelpers';
import { assetTypeLabels, normalizeAssetPayload } from '../../utils/assetHelpers';
import { FieldArrayInput } from './FieldArrayInput';
import { RelationPicker } from './RelationPicker';

const statuses = ['canon', 'draft', 'deprecated', 'under_review'] as const;
const spoilerLevels = ['public', 'internal', 'secret'] as const;
const characterTypes = ['protagonist', 'playable_hero', 'boss', 'story_npc', 'faction_member', 'law_enforcement', 'civilian'];
const storylineTypes = ['main', 'side', 'character', 'district', 'faction', 'prologue', 'event'];
const poiTiers = ['landmark', 'safehouse', 'street', 'business', 'hideout'];

const arrayFieldsByType: Record<AssetType, string[]> = {
  factions: ['culturalRoot', 'territoryDistrictIds', 'headquartersPoiIds', 'coreBusiness', 'allies', 'enemies', 'visualKeywords', 'missionTypes'],
  districts: ['atmosphere', 'dominantFactions', 'keyPoiIds', 'storyUsage', 'gameplayUsage'],
  pois: ['gameplayUsage', 'storyUsage'],
  characters: ['playableScripts'],
  storylines: ['relatedPlayableCharacters', 'relatedBosses'],
};

const scalarFieldsByType: Record<AssetType, string[]> = {
  factions: ['factionCategory'],
  districts: ['realWorldReference', 'districtStatus'],
  pois: ['districtId', 'poiTier', 'realWorldReference', 'addressReference'],
  characters: ['characterType', 'gender', 'age', 'nationality', 'ethnicity', 'occupation', 'factionId', 'districtId', 'weapon', 'attribute', 'characterArc', 'currentTimelineStatus'],
  storylines: ['storylineType', 'act', 'mainConflict', 'playerGoal', 'endingState', 'timelinePlacement', 'pitchStatus'],
};

function isSelectField(field: string) {
  return ['status', 'spoilerLevel', 'characterType', 'storylineType', 'poiTier'].includes(field);
}
function optionsFor(field: string) {
  if (field === 'status') return statuses;
  if (field === 'spoilerLevel') return spoilerLevels;
  if (field === 'characterType') return characterTypes;
  if (field === 'storylineType') return storylineTypes;
  if (field === 'poiTier') return poiTiers;
  return [];
}
const fieldLabels: Record<string, string> = { name: '名称', chineseName: '中文名', englishName: '英文名', category: '类别', status: '状态', spoilerLevel: '保密等级', characterType: '角色类型', gender: '性别', age: '年龄', nationality: '国籍', ethnicity: '族裔', occupation: '职业', factionId: '帮派 ID', districtId: '区域 ID', weapon: '武器', attribute: '属性', characterArc: '角色弧光', currentTimelineStatus: '当前时间线状态', factionCategory: '帮派类别', realWorldReference: '现实参考', districtStatus: '区域状态', poiTier: '地点等级', addressReference: '地址参考', storylineType: '剧情线类型', act: '幕', mainConflict: '主要冲突', playerGoal: '玩家目标', endingState: '结局状态', timelinePlacement: '时间线位置', pitchStatus: 'Pitch 状态', culturalRoot: '文化根源', territoryDistrictIds: '地盘区域 ID', headquartersPoiIds: '总部地点 ID', coreBusiness: '核心业务', allies: '盟友', enemies: '敌人', visualKeywords: '视觉关键词', missionTypes: '任务类型', atmosphere: '氛围', dominantFactions: '主导帮派', keyPoiIds: '关键地点 ID', storyUsage: '剧情用途', gameplayUsage: '玩法用途', playableScripts: '可玩脚本', relatedPlayableCharacters: '关联可操控角色', relatedBosses: '关联 Boss' };
const nice = (field: string) => fieldLabels[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
const arrayValue = (value: unknown): string[] => Array.isArray(value) ? value.map(String).filter(Boolean) : String(value ?? '').split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
const formTitleLabels: Record<AssetType, string> = {
  factions: '帮派',
  characters: '角色',
  districts: '区域',
  pois: '地点',
  storylines: '剧情线',
};

export function AssetFormDrawer({ open, type, asset, templateId, initialAsset, bundle, onClose, onSubmit, onOpenDuplicate }: { open: boolean; type: AssetType; asset?: AnyAsset; templateId?: DossierTemplateId; initialAsset?: Partial<AnyAsset>; bundle: AssetBundle; onClose: () => void; onSubmit: (asset: AnyAsset) => Promise<void> | void; onOpenDuplicate?: (asset: AnyAsset) => void }) {
  const template = templateId ? templateById(templateId) : undefined;
  const initial = useMemo(() => normalizeAssetPayload(type, asset ?? { ...(template?.defaults ?? {}), ...(initialAsset ?? {}) }), [asset, type, templateId, initialAsset]);
  const [draft, setDraft] = useState<Record<string, unknown>>(initial as unknown as Record<string, unknown>);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(initial as unknown as Record<string, unknown>), [initial, open]);
  if (!open) return null;

  const set = (key: string, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit(normalizeAssetPayload(type, draft as Partial<AnyAsset>));
      onClose();
    } catch {
      // The caller posts a wire notice; keep the drawer open so the typist can retry.
    } finally {
      setSaving(false);
    }
  };

  const formTitle = `${asset ? 'Edit' : 'New'} ${template?.englishName ?? formTitleLabels[type] ?? assetTypeLabels[type]} Record`;
  const allAssets = [...bundle.factions, ...bundle.districts, ...bundle.pois, ...bundle.characters, ...bundle.storylines] as AnyAsset[];
  const duplicateHits = detectDuplicates(draft as Partial<AnyAsset>, allAssets, asset?.id || String(draft.id || ''));
  const preferred = template?.preferredFields ?? [];
  const scalarFields = [...preferred.filter((field) => scalarFieldsByType[type].includes(field)), ...scalarFieldsByType[type].filter((field) => !preferred.includes(field))];
  const arrayFields = [...preferred.filter((field) => arrayFieldsByType[type].includes(field)), ...arrayFieldsByType[type].filter((field) => !preferred.includes(field))];

  const renderScalar = (field: string) => (
    <label key={field}>
      <span className="field-label">{nice(field)}</span>
      {isSelectField(field) ? (
        <select className="paper-input" value={String(draft[field] ?? '')} onChange={(event) => set(field, event.target.value)}>
          {optionsFor(field).map((option) => <option key={option} value={option}>{field === 'status' ? statusLabel(option) : field === 'spoilerLevel' ? spoilerLabel(option) : option}</option>)}
        </select>
      ) : (
        <input className="paper-input" value={String(draft[field] ?? '')} onChange={(event) => set(field, event.target.value)} placeholder="请输入内容" />
      )}
    </label>
  );

  return (
    <div className="fixed inset-0 z-[60] flex justify-end overflow-hidden bg-espresso/70 p-3 pt-20 backdrop-blur-sm md:p-6 md:pt-24">
      <aside className="flex h-full max-h-[calc(100vh-6rem)] w-full max-w-3xl flex-col overflow-hidden border-l-4 border-brass bg-paper shadow-noir">
        <div className="shrink-0 border-b border-brass/30 bg-paper/95 p-5 backdrop-blur md:p-6">
          <p className="type-label text-crimson">CONFIDENTIAL DOSSIER FORM</p>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl text-espresso">{formTitle}</h2>
            <button className="stamp border-walnut text-walnut" onClick={onClose}>关闭档案</button>
          </div>
        </div>


        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <DuplicateWarning hits={duplicateHits} onOpen={(hit) => onOpenDuplicate?.(hit.asset)} />
          {['name', 'chineseName', 'englishName', 'category'].map(renderScalar)}
          <label className="md:col-span-2"><span className="field-label">摘要</span><textarea className="paper-input min-h-24" value={String(draft.summary ?? '')} onChange={(event) => set('summary', event.target.value)} /></label>
          <label className="md:col-span-2"><span className="field-label">详细说明</span><textarea className="paper-input min-h-36" value={String(draft.details ?? '')} onChange={(event) => set('details', event.target.value)} /></label>
          {renderScalar('status')}
          {renderScalar('spoilerLevel')}
          <FieldArrayInput label="别名" value={arrayValue(draft.aliases)} onChange={(value) => set('aliases', value)} />
          <FieldArrayInput label="标签" value={arrayValue(draft.tags)} onChange={(value) => set('tags', value)} />
          {scalarFields.map(renderScalar)}
          {arrayFields.map((field) => <FieldArrayInput key={field} label={nice(field)} value={arrayValue(draft[field])} onChange={(value) => set(field, value)} />)}
          <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
            <RelationPicker label="关联帮派" type="factions" value={(draft.relatedFactionIds as string[]) ?? []} bundle={bundle} onChange={(value) => set('relatedFactionIds', value)} />
            <RelationPicker label="关联区域" type="districts" value={(draft.relatedDistrictIds as string[]) ?? []} bundle={bundle} onChange={(value) => set('relatedDistrictIds', value)} />
            <RelationPicker label="关联地点" type="pois" value={(draft.relatedPoiIds as string[]) ?? []} bundle={bundle} onChange={(value) => set('relatedPoiIds', value)} />
            <RelationPicker label="关联角色" type="characters" value={(draft.relatedCharacterIds as string[]) ?? []} bundle={bundle} onChange={(value) => set('relatedCharacterIds', value)} />
            <RelationPicker label="关联剧情线" type="storylines" value={(draft.relatedStorylineIds as string[]) ?? []} bundle={bundle} onChange={(value) => set('relatedStorylineIds', value)} />
          </div>
          <FieldArrayInput label="叙事限制" value={arrayValue(draft.narrativeConstraints)} onChange={(value) => set('narrativeConstraints', value)} />
          <FieldArrayInput label="暂不公开" value={arrayValue(draft.doNotRevealYet)} onChange={(value) => set('doNotRevealYet', value)} />
          <FieldArrayInput label="来源备注" value={arrayValue(draft.sourceNotes)} onChange={(value) => set('sourceNotes', value)} />
        </div>
        </div>
        <div className="shrink-0 border-t border-brass/30 bg-paper/95 p-4 shadow-[0_-12px_24px_rgba(33,19,15,0.12)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="type-label text-walnut/60">LOCAL JSON FILING DESK</p>
            <div className="flex justify-end gap-3">
              <button className="stamp border-walnut text-walnut" disabled={saving} onClick={onClose}>取消</button>
              <button className="evidence-button disabled:cursor-wait disabled:opacity-60" disabled={saving} onClick={() => void submit()}>{saving ? '正在保存…' : '保存档案'}</button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

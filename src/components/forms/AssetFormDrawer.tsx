import { useEffect, useMemo, useState } from 'react';
import type { AnyAsset } from '../../data';
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
  factions: ['territoryDistrictIds', 'headquartersPoiIds', 'coreBusiness', 'allies', 'enemies', 'visualKeywords', 'missionTypes'],
  districts: ['atmosphere', 'dominantFactions', 'keyPoiIds', 'storyUsage', 'gameplayUsage'],
  pois: ['gameplayUsage', 'storyUsage'],
  characters: ['playableScripts'],
  storylines: ['relatedPlayableCharacters', 'relatedBosses'],
};

const scalarFieldsByType: Record<AssetType, string[]> = {
  factions: ['factionCategory', 'culturalRoot'],
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
const nice = (field: string) => field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
const formTitleLabels: Record<AssetType, string> = {
  factions: 'Faction',
  characters: 'Character',
  districts: 'District',
  pois: 'POI',
  storylines: 'Storyline',
};

export function AssetFormDrawer({ open, type, asset, bundle, onClose, onSubmit }: { open: boolean; type: AssetType; asset?: AnyAsset; bundle: AssetBundle; onClose: () => void; onSubmit: (asset: AnyAsset) => Promise<void> | void }) {
  const initial = useMemo(() => normalizeAssetPayload(type, asset ?? {}), [asset, type]);
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

  const formTitle = `${asset ? 'Edit' : 'New'} ${formTitleLabels[type] ?? assetTypeLabels[type]} Record`;

  const renderScalar = (field: string) => (
    <label key={field}>
      <span className="field-label">{nice(field)}</span>
      {isSelectField(field) ? (
        <select className="paper-input" value={String(draft[field] ?? '')} onChange={(event) => set(field, event.target.value)}>
          {optionsFor(field).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input className="paper-input" value={String(draft[field] ?? '')} onChange={(event) => set(field, event.target.value)} placeholder="Typewriter entry" />
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
            <button className="stamp border-walnut text-walnut" onClick={onClose}>CLOSE FILE</button>
          </div>
        </div>


        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {['name', 'chineseName', 'englishName', 'category'].map(renderScalar)}
          <label className="md:col-span-2"><span className="field-label">Summary</span><textarea className="paper-input min-h-24" value={String(draft.summary ?? '')} onChange={(event) => set('summary', event.target.value)} /></label>
          <label className="md:col-span-2"><span className="field-label">Details</span><textarea className="paper-input min-h-36" value={String(draft.details ?? '')} onChange={(event) => set('details', event.target.value)} /></label>
          {renderScalar('status')}
          {renderScalar('spoilerLevel')}
          <FieldArrayInput label="Aliases" value={(draft.aliases as string[]) ?? []} onChange={(value) => set('aliases', value)} />
          <FieldArrayInput label="Tags" value={(draft.tags as string[]) ?? []} onChange={(value) => set('tags', value)} />
          {scalarFieldsByType[type].map(renderScalar)}
          {arrayFieldsByType[type].map((field) => <FieldArrayInput key={field} label={nice(field)} value={(draft[field] as string[]) ?? []} onChange={(value) => set(field, value)} />)}
          <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
            <RelationPicker label="Related Factions" type="factions" value={(draft.relatedFactionIds as string[]) ?? []} bundle={bundle} onChange={(value) => set('relatedFactionIds', value)} />
            <RelationPicker label="Related Districts" type="districts" value={(draft.relatedDistrictIds as string[]) ?? []} bundle={bundle} onChange={(value) => set('relatedDistrictIds', value)} />
            <RelationPicker label="Related POI" type="pois" value={(draft.relatedPoiIds as string[]) ?? []} bundle={bundle} onChange={(value) => set('relatedPoiIds', value)} />
            <RelationPicker label="Related Characters" type="characters" value={(draft.relatedCharacterIds as string[]) ?? []} bundle={bundle} onChange={(value) => set('relatedCharacterIds', value)} />
            <RelationPicker label="Related Storylines" type="storylines" value={(draft.relatedStorylineIds as string[]) ?? []} bundle={bundle} onChange={(value) => set('relatedStorylineIds', value)} />
          </div>
          <FieldArrayInput label="Narrative Constraints" value={(draft.narrativeConstraints as string[]) ?? []} onChange={(value) => set('narrativeConstraints', value)} />
          <FieldArrayInput label="Do Not Reveal Yet" value={(draft.doNotRevealYet as string[]) ?? []} onChange={(value) => set('doNotRevealYet', value)} />
          <FieldArrayInput label="Source Notes" value={(draft.sourceNotes as string[]) ?? []} onChange={(value) => set('sourceNotes', value)} />
        </div>
        </div>
        <div className="shrink-0 border-t border-brass/30 bg-paper/95 p-4 shadow-[0_-12px_24px_rgba(33,19,15,0.12)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="type-label text-walnut/60">LOCAL JSON FILING DESK</p>
            <div className="flex justify-end gap-3">
              <button className="stamp border-walnut text-walnut" disabled={saving} onClick={onClose}>CANCEL</button>
              <button className="evidence-button disabled:cursor-wait disabled:opacity-60" disabled={saving} onClick={() => void submit()}>{saving ? 'SAVING…' : 'SAVE TO LOCAL JSON'}</button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

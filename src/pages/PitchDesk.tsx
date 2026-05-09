import { useEffect, useMemo, useState } from 'react';
import type { AnyAsset, Storyline } from '../data';
import { AssetCard } from '../components/cards/AssetCard';
import { ConfirmDialog } from '../components/forms/ConfirmDialog';
import { PitchActions } from '../components/pitch/PitchActions';
import { PitchEditor } from '../components/pitch/PitchEditor';
import { PitchInsightPanel } from '../components/pitch/PitchInsightPanel';
import { PitchLoader } from '../components/pitch/PitchLoader';
import { defaultPitchDraft, PITCH_STORAGE_KEY, serializePitchText, type PitchDraft, type SavedPitch } from '../utils/pitch';
import { createAsset, deletePitch, upsertPitch, type AssetBundle } from '../utils/api';
import { detectAssetMentions, searchAssets } from '../utils/search';
import { SearchBox } from '../components/layout/SearchBox';

const loadDraft = (): PitchDraft => { try { const raw = localStorage.getItem(PITCH_STORAGE_KEY); return raw ? { ...defaultPitchDraft, ...JSON.parse(raw) } : defaultPitchDraft; } catch { return defaultPitchDraft; } };

export function PitchDesk({ assets, bundle, apiOnline, onAssetsChanged }: { assets: AnyAsset[]; bundle: AssetBundle; apiOnline: boolean; onAssetsChanged: (bundle: AssetBundle) => void }) {
  const [draft, setDraft] = useState<PitchDraft>(loadDraft);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const filtered = useMemo(() => searchAssets(assets, query).slice(0, 8), [assets, query]);
  const detected = useMemo(() => detectAssetMentions(assets, serializePitchText(draft)), [assets, draft]);
  useEffect(() => { localStorage.setItem(PITCH_STORAGE_KEY, JSON.stringify(draft)); }, [draft]);

  const save = async (source: PitchDraft = draft, forceNew = false) => {
    const now = new Date().toISOString();
    const saved = await upsertPitch({ ...source, id: forceNew ? undefined : source.id, status: source.status ?? 'draft', createdAt: source.createdAt ?? now, updatedAt: now });
    setDraft(saved);
    const exists = bundle.pitches.some((pitch) => pitch.id === saved.id);
    onAssetsChanged({ ...bundle, pitches: exists ? bundle.pitches.map((pitch) => pitch.id === saved.id ? saved : pitch) : [saved, ...bundle.pitches] });
  };
  const duplicate = () => void save({ ...draft, id: undefined, title: `${draft.title} Copy`, status: 'draft', createdAt: undefined, updatedAt: undefined }, true);
  const remove = async () => { if (!draft.id) return; await deletePitch(draft.id); onAssetsChanged({ ...bundle, pitches: bundle.pitches.filter((pitch) => pitch.id !== draft.id) }); setDraft(defaultPitchDraft); setConfirmDelete(false); };
  const convert = async () => {
    const storyline = await createAsset<Storyline>('storylines', { name: draft.title || 'Untitled Storyline Draft', chineseName: draft.title || '', englishName: draft.title || '', category: 'Storyline', summary: draft.logline, details: serializePitchText(draft), tags: ['pitch-conversion'], status: 'draft', spoilerLevel: 'internal', aliases: [], relatedFactionIds: detected.filter((a) => 'factionCategory' in a).map((a) => a.id), relatedDistrictIds: detected.filter((a) => 'atmosphere' in a).map((a) => a.id), relatedPoiIds: detected.filter((a) => 'poiTier' in a).map((a) => a.id), relatedCharacterIds: detected.filter((a) => 'characterType' in a).map((a) => a.id), relatedStorylineIds: [], narrativeConstraints: [], doNotRevealYet: [], sourceNotes: [`Converted from pitch ${draft.id ?? draft.title}`], storylineType: draft.type === '主线' ? 'main' : 'side', act: '', mainConflict: draft.coreConflict, playerGoal: draft.playerGoal, endingState: draft.ending, timelinePlacement: '', pitchStatus: 'under_review' });
    onAssetsChanged({ ...bundle, storylines: [storyline, ...bundle.storylines] });
  };

  return (
    <div className="grid gap-5 2xl:grid-cols-[320px_minmax(0,1fr)_380px]">
      <aside className="border border-brass/25 bg-walnut/45 p-4 shadow-dossier"><p className="type-label text-brass">FILE CABINET INDEX</p><h2 className="mb-4 font-display text-2xl text-ivory">资料索引</h2><SearchBox value={query} onChange={setQuery} placeholder="在写 pitch 时查资料" /><div className="mt-4 space-y-3">{filtered.map((asset) => <AssetCard key={asset.id} asset={asset} onSelect={() => setQuery(asset.name)} />)}{filtered.length === 0 ? <p className="border border-dashed border-brass/30 p-3 text-sm text-paper/60">本地 data JSON 暂无匹配资料。</p> : null}</div></aside>
      <div className="space-y-4">{!apiOnline ? <p className="border border-crimson/40 bg-burgundy/45 p-2 font-mono text-xs text-paper">Local API offline. Archive is read-only.</p> : null}<div className="dossier-panel p-4"><PitchLoader pitches={bundle.pitches as SavedPitch[]} currentId={draft.id} onLoad={setDraft} /><div className="mt-4"><PitchActions disabled={!apiOnline} onSave={() => void save()} onDuplicate={duplicate} onDelete={() => setConfirmDelete(true)} onConvert={() => void convert()} /></div></div><PitchEditor draft={draft} onChange={setDraft} /></div>
      <PitchInsightPanel detected={detected} />
      <ConfirmDialog open={confirmDelete} title="Delete Pitch?" message="This case proposal will be removed from data/pitches.json." confirmLabel="DELETE PITCH" onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} />
    </div>
  );
}

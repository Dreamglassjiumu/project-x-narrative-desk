import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnyAsset, Storyline } from '../data';
import { ConfirmDialog } from '../components/forms/ConfirmDialog';
import { PitchActions } from '../components/pitch/PitchActions';
import { PitchEditor } from '../components/pitch/PitchEditor';
import { PitchInsightPanel } from '../components/pitch/PitchInsightPanel';
import { PitchLoader } from '../components/pitch/PitchLoader';
import { defaultPitchDraft, getPitchLinkedAssets, normalizePitchDraft, normalizeSavedPitch, PITCH_STORAGE_KEY, serializePitchText, type PitchDraft, type SavedPitch } from '../utils/pitch';
import { archiveErrorMessage, createAsset, deletePitch, upsertPitch, type AssetBundle } from '../utils/api';
import { detectAssetMentions, searchAssets } from '../utils/search';
import { SearchBox } from '../components/layout/SearchBox';
import type { ArchiveNotifier } from '../components/ui/ArchiveNotice';
import { ClassifiedBadge } from '../components/ui/ClassifiedBadge';
import { StatusStamp } from '../components/ui/StatusStamp';

type LinkKey = 'linkedCharacterIds' | 'linkedFactionIds' | 'linkedDistrictIds' | 'linkedPoiIds' | 'linkedStorylineIds';
type SaveStatus = 'autosaved' | 'unsaved' | 'saved' | 'offline';

const loadDraft = (): PitchDraft => {
  try {
    const raw = localStorage.getItem(PITCH_STORAGE_KEY);
    return raw ? normalizePitchDraft(JSON.parse(raw)) : defaultPitchDraft;
  } catch {
    return defaultPitchDraft;
  }
};

const linkKeyForAsset = (asset: AnyAsset): LinkKey | undefined => {
  if ('characterType' in asset) return 'linkedCharacterIds';
  if ('factionCategory' in asset) return 'linkedFactionIds';
  if ('poiTier' in asset) return 'linkedPoiIds';
  if ('atmosphere' in asset) return 'linkedDistrictIds';
  if ('storylineType' in asset) return 'linkedStorylineIds';
  return undefined;
};

const uniqueAssets = (assets: AnyAsset[]): AnyAsset[] => Array.from(new Map(assets.map((asset) => [asset.id, asset])).values());

const firstParagraph = (body: string) => body.split('\n').map((line) => line.trim()).find(Boolean) ?? '';

function ArchiveSearchCard({ asset, onOpen, onAdd }: { asset: AnyAsset; onOpen: () => void; onAdd: () => void }) {
  return (
    <article className="case-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-label text-sm text-crimson">{asset.category} / {asset.id}</p>
          <h3 className="mt-1 font-display text-xl text-espresso">{asset.name}</h3>
          <p className="text-sm text-walnut/70">{asset.chineseName} · {asset.englishName}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusStamp status={asset.status} />
          <ClassifiedBadge level={asset.spoilerLevel} />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-espresso/80">{asset.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="stamp border-walnut text-walnut" onClick={onOpen}>打开</button>
        <button className="stamp border-brass bg-brass/10 text-walnut" onClick={onAdd}>添加关联</button>
      </div>
    </article>
  );
}

export function PitchDesk({ assets, bundle, apiOnline, onAssetsChanged, notify }: { assets: AnyAsset[]; bundle: AssetBundle; apiOnline: boolean; onAssetsChanged: (bundle: AssetBundle) => void; notify: ArchiveNotifier }) {
  const [draft, setDraft] = useState<PitchDraft>(loadDraft);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AnyAsset | undefined>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(apiOnline ? 'autosaved' : 'offline');
  const savedSnapshot = useRef(JSON.stringify(draft));

  const savedPitches = useMemo(() => bundle.pitches.map(normalizeSavedPitch), [bundle.pitches]);
  const filtered = useMemo(() => searchAssets(assets, query).slice(0, 8), [assets, query]);
  const detected = useMemo(() => detectAssetMentions(assets, serializePitchText(draft)), [assets, draft]);
  const manualLinks = useMemo(() => getPitchLinkedAssets(assets, draft), [assets, draft]);
  const riskAssets = useMemo(() => uniqueAssets([...manualLinks, ...detected]), [manualLinks, detected]);

  useEffect(() => {
    localStorage.setItem(PITCH_STORAGE_KEY, JSON.stringify(draft));
    if (!apiOnline) {
      setSaveStatus('offline');
      return;
    }
  }, [apiOnline, draft]);

  const updateDraft = (nextDraft: PitchDraft) => {
    setDraft(nextDraft);
    if (apiOnline) setSaveStatus('unsaved');
  };

  const addToPitchLinks = (asset: AnyAsset) => {
    const key = linkKeyForAsset(asset);
    if (!key) return;
    setDraft((current) => {
      const currentIds = current[key];
      if (currentIds.includes(asset.id)) return current;
      return { ...current, [key]: [...currentIds, asset.id] };
    });
    if (apiOnline) setSaveStatus('unsaved');
    notify({ tone: 'success', title: `${asset.name} added to Pitch Links.` });
  };

  const loadPitch = (pitch: SavedPitch) => {
    const normalized = normalizeSavedPitch(pitch);
    setDraft(normalized);
    savedSnapshot.current = JSON.stringify(normalized);
    setSaveStatus(apiOnline ? 'saved' : 'offline');
  };

  const save = async (source: PitchDraft = draft, forceNew = false) => {
    if (!apiOnline) return;
    const now = new Date().toISOString();
    try {
      const saved = normalizeSavedPitch(await upsertPitch({ ...source, id: forceNew ? undefined : source.id, createdAt: source.createdAt ?? now, updatedAt: now }));
      setDraft(saved);
      savedSnapshot.current = JSON.stringify(saved);
      setSaveStatus('saved');
      const exists = bundle.pitches.some((pitch) => pitch.id === saved.id);
      onAssetsChanged({ ...bundle, pitches: exists ? bundle.pitches.map((pitch) => pitch.id === saved.id ? saved : pitch) : [saved, ...bundle.pitches] });
      notify({ tone: 'success', title: 'Pitch 已保存到本地档案。' });
    } catch (error) {
      notify({ tone: 'error', title: archiveErrorMessage(error, '写入失败。') });
    }
  };

  const duplicate = () => void save({ ...draft, id: undefined, title: `${draft.title || '未命名 Pitch'} Copy`, status: 'draft', createdAt: undefined, updatedAt: undefined }, true);

  const remove = async () => {
    if (!draft.id || !apiOnline) return;
    try {
      await deletePitch(draft.id);
      onAssetsChanged({ ...bundle, pitches: bundle.pitches.filter((pitch) => pitch.id !== draft.id) });
      setDraft(defaultPitchDraft);
      savedSnapshot.current = JSON.stringify(defaultPitchDraft);
      setSaveStatus('autosaved');
      setConfirmDelete(false);
      notify({ tone: 'success', title: 'Pitch 已从本地档案删除。' });
    } catch (error) {
      notify({ tone: 'error', title: archiveErrorMessage(error, '写入失败。') });
    }
  };

  const convert = async () => {
    if (!apiOnline) return;
    const linkedAndDetected = uniqueAssets([...manualLinks, ...detected]);
    try {
      const storyline = await createAsset<Storyline>('storylines', {
        name: draft.title || '未命名剧情线草稿',
        chineseName: draft.title || '',
        englishName: draft.title || '',
        category: 'Storyline',
        summary: firstParagraph(draft.body) || draft.title,
        details: serializePitchText(draft),
        tags: ['pitch-conversion'],
        status: 'draft',
        spoilerLevel: 'internal',
        aliases: [],
        relatedFactionIds: linkedAndDetected.filter((a) => 'factionCategory' in a).map((a) => a.id),
        relatedDistrictIds: linkedAndDetected.filter((a) => 'atmosphere' in a).map((a) => a.id),
        relatedPoiIds: linkedAndDetected.filter((a) => 'poiTier' in a).map((a) => a.id),
        relatedCharacterIds: linkedAndDetected.filter((a) => 'characterType' in a).map((a) => a.id),
        relatedStorylineIds: draft.linkedStorylineIds,
        narrativeConstraints: [],
        doNotRevealYet: [],
        sourceNotes: [`从 Pitch 转换 ${draft.id ?? draft.title}`],
        storylineType: draft.type === 'main' ? 'main' : draft.type === 'side' ? 'side' : draft.type === 'other' ? 'side' : draft.type,
        act: '',
        mainConflict: '',
        playerGoal: '',
        endingState: '',
        timelinePlacement: '',
        pitchStatus: 'under_review',
      });
      onAssetsChanged({ ...bundle, storylines: [storyline, ...bundle.storylines] });
      notify({ tone: 'success', title: '剧情线草稿已保存到本地档案。' });
    } catch (error) {
      notify({ tone: 'error', title: archiveErrorMessage(error, '写入失败。') });
    }
  };

  const clearDraft = () => {
    setDraft(defaultPitchDraft);
    savedSnapshot.current = JSON.stringify(defaultPitchDraft);
    setSaveStatus(apiOnline ? 'autosaved' : 'offline');
  };

  return (
    <div className="grid gap-5 2xl:grid-cols-[340px_minmax(0,1fr)_390px]">
      <aside className="border border-brass/25 bg-walnut/45 p-4 shadow-dossier">
        <p className="type-label text-brass">ARCHIVE SEARCH</p>
        <h2 className="mb-4 font-display text-2xl text-ivory">档案搜索</h2>
        <SearchBox value={query} onChange={setQuery} placeholder="搜索角色、帮派、区域、POI、剧情线" />
        <div className="mt-4 space-y-3">
          {filtered.map((asset) => <ArchiveSearchCard key={asset.id} asset={asset} onOpen={() => setSelectedAsset(asset)} onAdd={() => addToPitchLinks(asset)} />)}
          {filtered.length === 0 ? <p className="border border-dashed border-brass/30 p-3 text-sm text-paper/60">本地 data JSON 暂无匹配资料。</p> : null}
        </div>
        {selectedAsset ? (
          <div className="mt-4 border border-brass/35 bg-espresso/75 p-3 text-paper shadow-card">
            <p className="type-label text-brass">档案详情</p>
            <h3 className="mt-2 font-display text-xl text-ivory">{selectedAsset.name}</h3>
            <p className="mt-2 text-sm leading-6 text-paper/75">{selectedAsset.details || selectedAsset.summary}</p>
          </div>
        ) : null}
      </aside>

      <main className="min-w-0 space-y-4">
        {!apiOnline ? <p className="border border-crimson/40 bg-burgundy/45 p-2 font-mono text-xs text-paper">本地接口离线，当前为只读模式。</p> : null}
        <div className="dossier-panel p-4">
          <PitchLoader pitches={savedPitches} currentId={draft.id} onLoad={loadPitch} />
          <div className="mt-4"><PitchActions disabled={!apiOnline} onSave={() => void save()} onDuplicate={duplicate} onDelete={() => setConfirmDelete(true)} onConvert={() => void convert()} onClear={clearDraft} /></div>
        </div>
        <PitchEditor draft={draft} assets={bundle} onChange={updateDraft} />
      </main>

      <PitchInsightPanel draft={draft} manualLinks={manualLinks} detected={detected} riskAssets={riskAssets} saveStatus={saveStatus} />
      <ConfirmDialog open={confirmDelete} title="删除 Pitch？" message="此 Pitch 将从 data/pitches.json 中删除。" confirmLabel="删除 Pitch" onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} />
    </div>
  );
}

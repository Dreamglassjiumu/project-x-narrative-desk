import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnyAsset } from '../data';
import type { ArchiveNotifier } from '../components/ui/ArchiveNotice';
import { dossierTemplates } from '../components/templates/templateDefaults';
import type { AssetBundle, IntakeDraft, UploadedFileRecord } from '../utils/api';
import { archiveErrorMessage, fetchAssetBundle, fileIntakeDraft, fileIntakeDraftBatch, flattenAssets, listIntakeDrafts, listUploads, parseIntakeFile, rejectIntakeDraft, saveIntakeDrafts, updateIntakeDraft, uploadFiles } from '../utils/api';
import type { AssetType } from '../utils/assetHelpers';
import { assetTypeLabels } from '../utils/assetHelpers';
import { detectDuplicates } from '../utils/duplicateDetection';
import { getCompleteness } from '../utils/completeness';

const parserModes = ['Auto Detect', 'Faction Sheet', 'Character Sheet', 'District Sheet', 'POI Sheet', 'Storyline Sheet', 'Raw Text', 'Image Evidence', 'Existing Archive JSON'];
const targetTypes: AssetType[] = ['factions', 'districts', 'pois', 'characters', 'storylines'];
const commonFields = ['name','chineseName','englishName','aliases','category','summary','details','tags','status','spoilerLevel','narrativeConstraints','doNotRevealYet','sourceNotes','relatedFactionIds','relatedDistrictIds','relatedPoiIds','relatedCharacterIds','relatedStorylineIds'];
const extraFields: Record<AssetType, string[]> = {
  characters: ['characterType','gender','age','nationality','ethnicity','occupation','factionId','districtId','weapon','attribute','playableScripts','characterArc','currentTimelineStatus'],
  factions: ['factionCategory','culturalRoot','territoryDistrictIds','headquartersPoiIds','coreBusiness','allies','enemies','visualKeywords','missionTypes'],
  districts: ['realWorldReference','atmosphere','dominantFactions','keyPoiIds','storyUsage','gameplayUsage','districtStatus'],
  pois: ['districtId','poiTier','realWorldReference','addressReference','gameplayUsage','storyUsage'],
  storylines: ['storylineType','timeline','act','relatedPlayableCharacters','relatedBosses','mainConflict','playerGoal','endingState','timelinePlacement','pitchStatus'],
};
const formatSize = (size: number) => size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;
const modeForFile = (file?: UploadedFileRecord) => {
  const ext = file?.name?.split('.').pop()?.toLowerCase() || '';
  if (file?.type?.startsWith('image/') || ['png','jpg','jpeg','webp'].includes(ext)) return 'Image Evidence';
  if (['csv','xlsx','xls'].includes(ext)) return 'Sheet';
  if (['md','markdown','txt'].includes(ext)) return 'Raw Text';
  if (ext === 'json') return 'Existing Archive JSON';
  if (['pdf','doc','docx'].includes(ext)) return 'raw_document';
  return 'Auto Detect';
};
const isSheet = (file?: UploadedFileRecord, mode?: string) => ['csv','xlsx','xls'].includes(file?.name?.split('.').pop()?.toLowerCase() || '') || Boolean(mode?.includes('Sheet')) || mode === 'Sheet';
const isText = (file?: UploadedFileRecord, mode?: string) => ['md','markdown','txt'].includes(file?.name?.split('.').pop()?.toLowerCase() || '') || mode === 'Raw Text';
const isImage = (file?: UploadedFileRecord, mode?: string) => file?.type?.startsWith('image/') || mode === 'Image Evidence';
const textValue = (value: unknown) => Array.isArray(value) ? value.join(', ') : String(value ?? '');

export function EvidenceIntake({ bundle, files, apiOnline, onFilesChanged, onAssetsChanged, notify }: { bundle: AssetBundle; files: UploadedFileRecord[]; apiOnline: boolean; onFilesChanged: (files: UploadedFileRecord[]) => void; onAssetsChanged: (bundle: AssetBundle) => void; notify: ArchiveNotifier }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [drafts, setDrafts] = useState<IntakeDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [parserMode, setParserMode] = useState('Auto Detect');
  const [targetType, setTargetType] = useState<AssetType>('characters');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [textSplitMode, setTextSplitMode] = useState<'full' | 'headings' | 'separator'>('full');
  const [separator, setSeparator] = useState('---');
  const [template, setTemplate] = useState('story_npc');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [editing, setEditing] = useState<IntakeDraft | null>(null);
  const [jsonPreview, setJsonPreview] = useState<IntakeDraft | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const allAssets = useMemo(() => flattenAssets(bundle), [bundle]);
  const queue = useMemo(() => queueIds.map((id) => files.find((file) => file.id === id)).filter(Boolean) as UploadedFileRecord[], [files, queueIds]);
  const selectedFile = files.find((file) => file.id === selectedId) || queue[0];
  const fieldOptions = useMemo(() => [...new Set([...commonFields, ...extraFields[targetType]])], [targetType]);

  useEffect(() => { if (apiOnline) void listIntakeDrafts().then(setDrafts).catch(() => undefined); }, [apiOnline]);
  useEffect(() => { if (selectedFile) setParserMode(modeForFile(selectedFile)); }, [selectedFile?.id]);

  const addFilesToQueue = (ids: string[]) => {
    const next = [...new Set([...queueIds, ...ids])];
    setQueueIds(next); if (!selectedId && ids[0]) setSelectedId(ids[0]);
  };
  const uploadEvidence = async (fileList: FileList | null) => {
    if (!fileList?.length || !apiOnline) return;
    setBusy(true);
    try {
      const uploaded = await uploadFiles(fileList, { fileUsage: 'intake_queue', tags: ['intake'] });
      onFilesChanged([...uploaded, ...files]); addFilesToQueue(uploaded.map((file) => file.id));
      if (inputRef.current) inputRef.current.value = '';
      notify({ tone: 'success', title: 'Evidence bagged for intake.', detail: uploaded.map((file) => file.name).join('\n') });
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, 'Upload failed') }); }
    finally { setBusy(false); }
  };
  const parseCurrent = async (createDrafts = false) => {
    if (!selectedFile || !apiOnline) return;
    setBusy(true); setMessage('');
    try {
      const response = await parseIntakeFile({ fileId: selectedFile.id, parserMode, targetType, mapping, createDrafts, textSplitMode, separator, template });
      setPreview(response.preview || null); setMessage(response.message || '');
      if (response.preview && 'guessedMapping' in response.preview) setMapping(response.preview.guessedMapping || {});
      if (createDrafts && response.drafts.length) {
        const saved = await saveIntakeDrafts(response.drafts);
        setDrafts([...saved, ...drafts]); setSelectedDraftIds(saved.map((draft) => draft.id));
        notify({ tone: 'success', title: 'Parsed drafts placed in review tray.', detail: `${saved.length} draft(s) require human confirmation before filing.` });
      }
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, 'Parse failed') }); }
    finally { setBusy(false); }
  };
  const batchImages = async () => {
    if (!apiOnline || !selectedImages.length) return;
    setBusy(true);
    try {
      const results = await Promise.all(selectedImages.map((fileId) => parseIntakeFile({ fileId, parserMode: 'Image Evidence', template, createDrafts: true })));
      const incoming = results.flatMap((result) => result.drafts);
      const saved = incoming.length ? await saveIntakeDrafts(incoming) : [];
      setDrafts([...saved, ...drafts]); setSelectedDraftIds(saved.map((draft) => draft.id));
      notify({ tone: 'success', title: 'Image evidence batch converted to drafts.', detail: `${saved.length} mugshot/card draft(s) now await review.` });
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, 'Batch parse failed') }); }
    finally { setBusy(false); }
  };
  const saveDraftEdit = async () => {
    if (!editing) return;
    try { const saved = await updateIntakeDraft(editing.id, editing); setDrafts(drafts.map((draft) => draft.id === saved.id ? saved : draft)); setEditing(null); notify({ tone: 'success', title: 'Draft notes amended.' }); }
    catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, 'Draft update failed') }); }
  };
  const fileDraft = async (draft: IntakeDraft, mergeIntoId?: string) => {
    if (!apiOnline) return;
    const dupes = detectDuplicates(draft.asset, allAssets);
    if (dupes.length && !mergeIntoId && !window.confirm('Possible duplicate dossier detected. Continue as new?')) return;
    try {
      const result = await fileIntakeDraft(draft.id, mergeIntoId ? { mergeIntoId } : undefined);
      setDrafts((current) => current.map((item) => item.id === draft.id ? result.draft : item));
      onAssetsChanged({ ...bundle, [draft.targetType]: [result.asset, ...(bundle[draft.targetType] as AnyAsset[])] });
      onFilesChanged(await listUploads().catch(() => files));
      notify({ tone: 'success', title: 'Draft approved and filed.', detail: `${result.asset.name} written to data/${draft.targetType}.json` });
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, 'Filing failed') }); }
  };
  const rejectDraft = async (draft: IntakeDraft) => {
    try { await rejectIntakeDraft(draft.id); setDrafts(drafts.map((item) => item.id === draft.id ? { ...item, status: 'rejected' } : item)); notify({ tone: 'success', title: 'Draft rejected. Original evidence retained.' }); }
    catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, 'Reject failed') }); }
  };
  const fileBatch = async () => {
    if (!apiOnline || !selectedDraftIds.length) return;
    if (!window.confirm('Batch Approve & File will create data/backups before import. Continue?')) return;
    try {
      const result = await fileIntakeDraftBatch(selectedDraftIds);
      onAssetsChanged(await fetchAssetBundle()); setDrafts(await listIntakeDrafts()); onFilesChanged(await listUploads().catch(() => files));
      notify({ tone: 'success', title: 'Batch import filed after backup.', detail: `${result.backup.filename}\n${result.filed.length} dossier(s) filed.` });
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, 'Batch filing failed') }); }
  };
  const queueStatus = (file: UploadedFileRecord) => {
    const fileDrafts = drafts.filter((draft) => draft.sourceFileId === file.id);
    if (fileDrafts.some((draft) => draft.status === 'filed')) return 'filed';
    if (fileDrafts.some((draft) => draft.status === 'needs_review')) return 'needs_review';
    if (preview && selectedFile?.id === file.id) return 'parsed';
    return 'unparsed';
  };

  const sheetPreview = preview && typeof preview === 'object' && 'kind' in preview && preview.kind === 'sheet' ? preview as unknown as { headers: string[]; rows: string[][]; guessedMapping: Record<string, string> } : null;
  const textPreview = preview && typeof preview === 'object' && 'kind' in preview && preview.kind === 'text' ? preview as unknown as { text: string; chunks: Array<{ name: string; details: string }> } : null;

  return (
    <section className="space-y-6">
      <div className="border border-brass/30 bg-espresso/90 p-5 shadow-dossier">
        <p className="type-label text-crimson">[IN] EVIDENCE INTAKE / 证物接收台</p>
        <h2 className="font-display text-4xl text-ivory">Universal Evidence Receiving Desk</h2>
        <p className="mt-2 max-w-4xl text-sm text-paper/75">A smoky old-police sorting table for raw PNG/JPG/WEBP, CSV, Markdown, TXT, JSON, and raw PDF/Word evidence. Nothing enters the official archive until a detective approves a parsed draft.</p>
        {!apiOnline ? <p className="mt-4 border border-crimson/50 bg-burgundy/50 p-3 font-mono text-xs text-paper">LOCAL API OFFLINE · Intake parsing and filing controls are disabled. GitHub Pages demo stays read-only with mock dossiers.</p> : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        <div className="dossier-panel p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-brass/30 pb-3"><div><p className="type-label text-crimson">INTAKE QUEUE / 待解析队列</p><h3 className="font-display text-2xl text-espresso">Evidence Bags on the Counter</h3></div><label className="stamp border-brass text-brass disabled:opacity-50">UPLOAD TO INTAKE<input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,.md,.markdown,.json,.txt,.pdf,.doc,.docx,.xls,.xlsx,.csv" className="hidden" disabled={!apiOnline || busy} onChange={(event) => void uploadEvidence(event.target.files)} /></label></div>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]"><select className="paper-input" disabled={!apiOnline} onChange={(e) => e.target.value && addFilesToQueue([e.target.value])} value=""><option value="">Add existing Local Library evidence…</option>{files.map((file) => <option key={file.id} value={file.id}>{file.name} · {file.type || 'unknown'}</option>)}</select><button className="stamp border-brass text-brass" onClick={() => addFilesToQueue(files.map((file) => file.id))}>ADD ALL LOCKER FILES</button></div>
          <div className="space-y-3">
            {queue.length === 0 ? <p className="border border-dashed border-walnut/30 bg-espresso/5 p-4 text-sm text-walnut/60">No evidence bags on the intake desk yet. Upload files or pull them from Local Library.</p> : null}
            {queue.map((file) => (
              <button key={file.id} onClick={() => setSelectedId(file.id)} className={`w-full border p-3 text-left transition ${selectedFile?.id === file.id ? 'border-crimson bg-burgundy/10' : 'border-walnut/20 bg-espresso/5 hover:border-brass/50'}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="type-label text-crimson">{file.folder === 'images' ? 'PHOTO EVIDENCE BAG' : 'DOCUMENT EVIDENCE BAG'}</p><p className="truncate font-mono text-sm text-espresso">{file.name}</p><p className="text-xs text-walnut/60">{file.type || 'unknown'} · {formatSize(file.size)} · uploaded {new Date(file.addedAt).toLocaleString()}</p><p className="text-xs text-walnut/60">linked evidence path: uploads/{file.folder || 'documents'}/{file.filename}</p></div><div className="shrink-0 text-right"><span className="stamp border-brass text-brass">{queueStatus(file)}</span><p className="mt-2 font-mono text-[10px] uppercase text-walnut/60">{modeForFile(file)}</p></div></div>
              </button>
            ))}
          </div>
        </div>

        <div className="dossier-panel p-5">
          <div className="mb-4 border-b border-brass/30 pb-3"><p className="type-label text-crimson">PARSER CONTROLS / 解析控制台</p><h3 className="font-display text-2xl text-espresso">Confidential Sorting Machine</h3></div>
          <div className="grid gap-3 md:grid-cols-2"><select className="paper-input" value={parserMode} onChange={(e) => setParserMode(e.target.value)}>{parserModes.map((mode) => <option key={mode}>{mode}</option>)}</select><select className="paper-input" value={targetType} onChange={(e) => { setTargetType(e.target.value as AssetType); setMapping({}); }}>{targetTypes.map((type) => <option key={type} value={type}>{assetTypeLabels[type]} / {type}</option>)}</select></div>
          {isText(selectedFile, parserMode) ? <div className="mt-3 grid gap-3 md:grid-cols-2"><select className="paper-input" value={textSplitMode} onChange={(e) => setTextSplitMode(e.target.value as 'full' | 'headings' | 'separator')}><option value="full">Create one dossier from full text</option><option value="headings">Split by # / ## / ### headings</option><option value="separator">Split by separator</option></select><input className="paper-input" value={separator} onChange={(e) => setSeparator(e.target.value)} placeholder="Separator e.g. ---" disabled={textSplitMode !== 'separator'} /></div> : null}
          {isImage(selectedFile, parserMode) ? <div className="mt-3 grid gap-3 md:grid-cols-2"><select className="paper-input" value={template} onChange={(e) => setTemplate(e.target.value)}>{dossierTemplates.map((item) => <option key={item.id} value={item.id}>{item.englishName} / {item.chineseName}</option>)}</select><button className="stamp border-brass text-brass disabled:opacity-50" disabled={!apiOnline || busy || !selectedFile} onClick={() => void parseCurrent(true)}>CREATE ONE IMAGE DRAFT</button></div> : null}
          <div className="mt-4 flex flex-wrap gap-2"><button className="stamp border-brass text-brass disabled:opacity-50" disabled={!apiOnline || busy || !selectedFile} onClick={() => void parseCurrent(false)}>READ PREVIEW</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!apiOnline || busy || !selectedFile} onClick={() => void parseCurrent(true)}>GENERATE PARSED DRAFTS</button></div>
          {message ? <p className="mt-3 border border-brass/30 bg-amber-100/40 p-3 font-mono text-xs text-walnut">{message}</p> : null}

          {isImage(selectedFile, parserMode) ? <div className="mt-5 border border-dashed border-brass/40 bg-espresso/5 p-3"><p className="type-label text-crimson">BATCH IMAGE DOSSIER STAMPER</p><div className="mt-2 max-h-40 space-y-1 overflow-auto">{files.filter((file) => file.type?.startsWith('image/')).map((file) => <label key={file.id} className="flex items-center gap-2 text-xs text-walnut"><input type="checkbox" checked={selectedImages.includes(file.id)} onChange={(e) => setSelectedImages((current) => e.target.checked ? [...new Set([...current, file.id])] : current.filter((id) => id !== file.id))} />{file.name}</label>)}</div><button className="stamp mt-3 border-brass text-brass disabled:opacity-50" disabled={!apiOnline || busy || !selectedImages.length} onClick={() => void batchImages()}>BATCH CREATE SELECTED IMAGES</button></div> : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <div className="dossier-panel p-5">
          <div className="mb-4 border-b border-brass/30 pb-3"><p className="type-label text-crimson">PREVIEW PANEL / 文件预览</p><h3 className="font-display text-2xl text-espresso">Evidence Under the Lamp</h3></div>
          {selectedFile?.type?.startsWith('image/') ? <img src={selectedFile.url} alt={selectedFile.name} className="mb-4 max-h-72 w-full border border-walnut/20 object-contain p-2" /> : null}
          {sheetPreview ? <div className="overflow-auto"><table className="w-full min-w-[620px] border-collapse font-mono text-xs"><thead><tr>{sheetPreview.headers.map((header) => <th key={header} className="border border-walnut/20 bg-espresso/10 p-2 text-left">{header}</th>)}</tr><tr>{sheetPreview.headers.map((header) => <th key={header} className="border border-walnut/20 p-1"><select className="paper-input py-1 text-xs" value={mapping[header] ?? sheetPreview.guessedMapping[header] ?? ''} onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })}><option value="">Do not import</option>{fieldOptions.map((field) => <option key={field} value={field}>{field}</option>)}</select></th>)}</tr></thead><tbody>{sheetPreview.rows.map((row, rowIndex) => <tr key={rowIndex}>{sheetPreview.headers.map((header, cellIndex) => <td key={header} className="border border-walnut/20 p-2 align-top">{row[cellIndex]}</td>)}</tr>)}</tbody></table></div> : null}
          {textPreview ? <div><div className="mb-3 max-h-48 overflow-auto whitespace-pre-wrap border border-walnut/20 bg-espresso/5 p-3 font-mono text-xs text-walnut">{textPreview.text}</div><p className="type-label text-crimson">Draft split preview</p>{textPreview.chunks.map((chunk) => <div key={chunk.name} className="mt-2 border border-walnut/20 bg-espresso/5 p-2"><p className="font-display text-lg text-espresso">{chunk.name}</p><p className="line-clamp-3 text-xs text-walnut/70">{chunk.details}</p></div>)}</div> : null}
          {!sheetPreview && !textPreview && !selectedFile?.type?.startsWith('image/') ? <p className="border border-dashed border-walnut/30 bg-espresso/5 p-4 text-sm text-walnut/60">Select evidence and press READ PREVIEW. PDF/Word evidence is preserved as raw documents; deep parsing is not available yet.</p> : null}
        </div>

        <div className="dossier-panel p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-brass/30 pb-3"><div><p className="type-label text-crimson">PARSED DRAFTS / 解析草稿区</p><h3 className="font-display text-2xl text-espresso">Review Tray Before Filing</h3></div><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!apiOnline || !selectedDraftIds.length} onClick={() => void fileBatch()}>BATCH APPROVE & FILE</button></div>
          <div className="space-y-3">
            {drafts.length === 0 ? <p className="border border-dashed border-walnut/30 bg-espresso/5 p-4 text-sm text-walnut/60">No parsed drafts yet. Parsing results will appear here first, never directly in data/*.json.</p> : null}
            {drafts.map((draft) => {
              const completeness = getCompleteness(draft.asset, files);
              const dupes = detectDuplicates(draft.asset, allAssets);
              return <div key={draft.id} className={`border p-3 ${draft.status === 'filed' ? 'border-teal/50 bg-teal/5' : draft.status === 'rejected' ? 'border-crimson/30 bg-burgundy/5 opacity-70' : 'border-walnut/20 bg-espresso/5'}`}>
                <div className="flex items-start justify-between gap-3"><div><label className="mb-1 flex items-center gap-2 font-mono text-xs text-walnut/70"><input type="checkbox" disabled={draft.status !== 'needs_review'} checked={selectedDraftIds.includes(draft.id)} onChange={(e) => setSelectedDraftIds((current) => e.target.checked ? [...new Set([...current, draft.id])] : current.filter((id) => id !== draft.id))} /> Select draft</label><p className="type-label text-crimson">{assetTypeLabels[draft.targetType]} · {draft.status}</p><h4 className="font-display text-xl text-espresso">{draft.asset.name}</h4><p className="text-xs text-walnut/60">source file: {draft.sourceFileName} · {draft.parserMode}</p></div><span className="stamp border-brass text-brass">{completeness.score}%</span></div>
                {dupes.length ? <div className="mt-2 border border-crimson/50 bg-crimson/10 p-2 font-mono text-xs text-crimson">Possible duplicate dossier detected. {dupes.map((hit) => hit.asset.name).join(', ')}</div> : null}
                <p className="mt-2 line-clamp-2 text-sm text-walnut/75">{draft.asset.summary || draft.asset.details || 'No summary supplied yet.'}</p>
                <div className="mt-3 flex flex-wrap gap-2"><button className="stamp border-brass text-brass" onClick={() => setEditing(draft)}>EDIT DRAFT</button><button className="stamp border-brass text-brass" onClick={() => setJsonPreview(draft)}>PREVIEW JSON</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!apiOnline || draft.status !== 'needs_review'} onClick={() => void fileDraft(draft)}>APPROVE & FILE</button><button className="stamp border-brass text-brass disabled:opacity-50" disabled={!apiOnline || !dupes.length || draft.status !== 'needs_review'} onClick={() => void fileDraft(draft, dupes[0]?.asset.id)}>MERGE WITH EXISTING</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!apiOnline || draft.status !== 'needs_review'} onClick={() => void rejectDraft(draft)}>REJECT</button></div>
              </div>;
            })}
          </div>
        </div>
      </div>

      {editing ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="dossier-panel max-h-[90vh] w-full max-w-3xl overflow-auto p-5"><p className="type-label text-crimson">EDIT DRAFT</p><input className="paper-input mt-3" value={editing.asset.name} onChange={(e) => setEditing({ ...editing, asset: { ...editing.asset, name: e.target.value } })} /><textarea className="paper-input mt-3 min-h-24" value={editing.asset.summary} onChange={(e) => setEditing({ ...editing, asset: { ...editing.asset, summary: e.target.value } })} /><textarea className="paper-input mt-3 min-h-48" value={editing.asset.details} onChange={(e) => setEditing({ ...editing, asset: { ...editing.asset, details: e.target.value } })} /><input className="paper-input mt-3" value={textValue(editing.asset.tags)} onChange={(e) => setEditing({ ...editing, asset: { ...editing.asset, tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) } })} placeholder="tags comma separated" /><div className="mt-4 flex justify-end gap-2"><button className="stamp border-brass text-brass" onClick={() => setEditing(null)}>CANCEL</button><button className="stamp border-crimson text-crimson" onClick={() => void saveDraftEdit()}>SAVE DRAFT</button></div></div></div> : null}
      {jsonPreview ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="dossier-panel max-h-[90vh] w-full max-w-3xl overflow-auto p-5"><p className="type-label text-crimson">PREVIEW JSON</p><pre className="mt-3 overflow-auto border border-walnut/20 bg-espresso/10 p-3 text-xs text-walnut">{JSON.stringify(jsonPreview.asset, null, 2)}</pre><div className="mt-4 text-right"><button className="stamp border-brass text-brass" onClick={() => setJsonPreview(null)}>CLOSE</button></div></div></div> : null}
    </section>
  );
}

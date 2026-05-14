import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnyAsset } from '../data';
import { EvidenceLightbox } from '../components/evidence/EvidenceLightbox';
import type { ArchiveNotifier } from '../components/ui/ArchiveNotice';
import { dossierTemplates } from '../components/templates/templateDefaults';
import { statusLabel } from '../i18n/zhCN';
import type { AssetType } from '../utils/assetHelpers';
import { assetTypeLabels } from '../utils/assetHelpers';
import { archiveErrorMessage, cleanIntakeDrafts, createOcrDraft, fetchAssetBundle, fileIntakeDraft, fileIntakeDraftBatchSafe, flattenAssets, listImportHistory, listIntakeDrafts, listOcrDesignTypes, mergeDossiers, parseIntakeFile, preflightIntake, previewOcrDraft, rejectIntakeDraft, runOcr, saveIntakeDrafts, saveOcrText, updateIntakeDraft, uploadFiles, type AssetBundle, type ImportHistoryRecord, type IntakeDraft, type OcrDesignType, type OcrDraftPreview, type UploadedFileRecord } from '../utils/api';
import { detectDuplicates } from '../utils/duplicateDetection';
import { getCompleteness } from '../utils/completeness';
import { clipboardImageFromEvent, mergeUploadedIntoFiles, notifyClipboardError, uploadClipboardScreenshot } from '../utils/clipboardEvidence';

const formatSize = (size: number) => size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;
const isImage = (file?: UploadedFileRecord) => Boolean(file?.type?.startsWith('image/') || file?.folder === 'images');
const wizardStorageKey = 'projectx.evidenceIntake.screenshotWizard.v058';
const fieldLinePattern = /^\s*[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z\s]{0,32}\s*[:：=]/u;
const cleanOcrText = (value: string) => {
  const fixed = value
    .replace(/^\s*(姓\s+名|姓各|ME)\s*[:：=]/gim, '姓名：')
    .replace(/英\s+文\s+名/g, '英文名')
    .replace(/简\s+介/g, '简介')
    .replace(/职\s+业/g, '职业')
    .replace(/标\s+签/g, '标签');
  const merged: string[] = [];
  for (const line of fixed.split(/\r?\n/).map((item) => item.trim())) {
    if (!line) { if (merged[merged.length - 1]) merged.push(''); continue; }
    const previous = merged[merged.length - 1];
    const canMerge = previous && !fieldLinePattern.test(previous) && !fieldLinePattern.test(line) && !/[。！？.!?：:]$/.test(previous) && line.length < 48;
    if (canMerge) merged[merged.length - 1] = `${previous}${/[\p{Script=Han}]$/u.test(previous) || /^[\p{Script=Han}]/u.test(line) ? '' : ' '}${line}`;
    else merged.push(line);
  }
  return merged.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

type WizardStep = 1 | 2 | 3;
type DraftFilter = 'recent' | 'current' | 'today' | 'unreviewed' | 'generated';
type PersistedWizard = { evidenceId: string; text: string; step: WizardStep; designType: string; draftId?: string };
const emptyPersistedWizard: PersistedWizard = { evidenceId: '', text: '', step: 1, designType: 'other_design' };

export function EvidenceIntake({ bundle, files, apiOnline, onFilesChanged, onAssetsChanged, notify }: { bundle: AssetBundle; files: UploadedFileRecord[]; apiOnline: boolean; onFilesChanged: (files: UploadedFileRecord[]) => void; onAssetsChanged: (bundle: AssetBundle) => void; notify: ArchiveNotifier }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wizardRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const [drafts, setDrafts] = useState<IntakeDraft[]>([]);
  const [history, setHistory] = useState<ImportHistoryRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState<PersistedWizard>(emptyPersistedWizard);
  const [showResume, setShowResume] = useState(false);
  const [floatingMinimized, setFloatingMinimized] = useState(false);
  const [manualText, setManualText] = useState('');
  const [preview, setPreview] = useState<OcrDraftPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [types, setTypes] = useState<OcrDesignType[]>([]);
  const [highlightDraftId, setHighlightDraftId] = useState('');
  const [draftFilter, setDraftFilter] = useState<DraftFilter>('recent');
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<IntakeDraft | null>(null);
  const [jsonPreview, setJsonPreview] = useState<IntakeDraft | null>(null);
  const [lightboxFile, setLightboxFile] = useState<UploadedFileRecord | null>(null);
  const [preflight, setPreflight] = useState<Awaited<ReturnType<typeof preflightIntake>> | null>(null);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [advancedMessage, setAdvancedMessage] = useState('');
  const [lastFiledAssetId, setLastFiledAssetId] = useState('');

  const allAssets = useMemo(() => flattenAssets(bundle), [bundle]);
  const imageFiles = useMemo(() => files.filter((file) => isImage(file)), [files]);
  const currentImage = files.find((file) => file.id === task.evidenceId);
  const currentType = types.find((item) => item.id === task.designType);
  const selectedFile = files.find((file) => file.id === selectedId) || files.find((file) => queueIds.includes(file.id));
  const hasTask = Boolean(task.evidenceId || task.text || task.draftId);
  const filteredDrafts = useMemo(() => {
    const today = new Date().toDateString();
    let list = [...drafts];
    if (draftFilter === 'current') list = list.filter((draft) => draft.sourceFileId === task.evidenceId);
    if (draftFilter === 'today') list = list.filter((draft) => new Date(draft.createdAt).toDateString() === today);
    if (draftFilter === 'unreviewed') list = list.filter((draft) => draft.status === 'needs_review');
    if (draftFilter === 'generated') list = list.filter((draft) => draft.status === 'needs_review' && Boolean(draft.sourceFileId));
    if (draftFilter === 'recent') list = list.filter((draft) => draft.status === 'needs_review');
    return list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [draftFilter, drafts, task.evidenceId]);
  const visibleDrafts = showAllDrafts ? filteredDrafts : filteredDrafts.slice(0, 6);

  const setWizardTask = (next: PersistedWizard) => {
    setTask(next);
    setManualText(next.text);
    localStorage.setItem(wizardStorageKey, JSON.stringify(next));
  };
  const scrollToWizard = () => wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const scrollToDrafts = () => draftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const abandonTask = () => { setTask(emptyPersistedWizard); setManualText(''); setPreview(null); setPreviewOpen(false); localStorage.removeItem(wizardStorageKey); };

  useEffect(() => {
    if (!apiOnline) return;
    void listIntakeDrafts().then(setDrafts).catch(() => undefined);
    void listImportHistory().then(setHistory).catch(() => undefined);
    void listOcrDesignTypes().then((items) => { setTypes(items); if (!items.some((item) => item.id === task.designType) && items[0]) setWizardTask({ ...task, designType: items[0].id }); }).catch(() => undefined);
  }, [apiOnline]);

  useEffect(() => {
    const raw = localStorage.getItem(wizardStorageKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as PersistedWizard;
      if (saved.evidenceId || saved.text) { setTask(saved); setManualText(saved.text || ''); setShowResume(true); }
    } catch { localStorage.removeItem(wizardStorageKey); }
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLInputElement) return;
      const image = clipboardImageFromEvent(event);
      if (!image) return;
      event.preventDefault();
      void pasteScreenshot(image);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [apiOnline, files, task, types]);

  const pasteScreenshot = async (file?: File) => {
    if (!apiOnline) return notify({ tone: 'error', title: '本地 API 未连接，无法保存截图。' });
    setBusy(true);
    try {
      let image = file;
      if (!image && navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((candidate) => candidate.startsWith('image/'));
          if (type) image = new File([await item.getType(type)], `clipboard-${Date.now()}.png`, { type });
        }
      }
      if (!image) return notify({ tone: 'error', title: '剪贴板中没有图片，请先使用 Windows 截图或 Snipaste 截图。' });
      const uploaded = await uploadClipboardScreenshot(image);
      onFilesChanged(mergeUploadedIntoFiles(uploaded, files));
      setQueueIds((current) => [...new Set([uploaded.id, ...current])]);
      setSelectedId(uploaded.id);
      setPreview(null);
      setPreviewOpen(false);
      setWizardTask({ evidenceId: uploaded.id, text: '', step: 2, designType: task.designType || types[0]?.id || 'other_design' });
      notify({ tone: 'success', title: '截图保存成功', detail: '下一步：粘贴识别文本 / 查看截图' });
      scrollToWizard();
    } catch (error) { notifyClipboardError(error, notify); }
    finally { setBusy(false); }
  };

  const saveText = async () => {
    if (!currentImage) return notify({ tone: 'error', title: '请先粘贴截图。' });
    if (!manualText.trim()) return notify({ tone: 'error', title: '请先自动识别文字，或手动粘贴文本后再分析。' });
    setBusy(true);
    try {
      await saveOcrText(currentImage.id, { text: manualText.trim(), status: 'manual_fallback', language: 'auto' });
      setWizardTask({ ...task, text: manualText.trim(), step: 2 });
      notify({ tone: 'success', title: '文本保存成功', detail: '下一步：分析资料卡片 / 返回修改文本' });
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '保存文本失败。') }); }
    finally { setBusy(false); }
  };

  const runWindowsOcrForCurrentImage = async () => {
    if (!currentImage) return notify({ tone: 'error', title: '请先粘贴截图。' });
    setBusy(true);
    try {
      const result = await runOcr({ fileId: currentImage.id, provider: 'winocr-powershell', language: 'zh-Hans', preprocess: 'scale2', psmMode: 'block' });
      const recognized = result.cleanedText || result.text || result.sourceOcrText || '';
      setManualText(recognized);
      setWizardTask({ ...task, text: recognized, step: 2 });
      notify({ tone: result.status === 'done' ? 'success' : 'info', title: result.status === 'done' ? 'Windows OCR 已识别，请校对后继续。' : 'Windows OCR 未识别到文本，请手动粘贴。', detail: result.error || currentImage.name });
    } catch (error) {
      notify({ tone: 'error', title: archiveErrorMessage(error, 'Windows OCR 识别失败，请手动粘贴文本。') });
      setWizardTask({ ...task, step: 2 });
    } finally { setBusy(false); }
  };

  const cleanText = () => {
    if (!manualText.trim()) return notify({ tone: 'error', title: '请粘贴识别文本后再分析。' });
    const cleaned = cleanOcrText(manualText);
    setManualText(cleaned);
    setWizardTask({ ...task, text: cleaned, step: 2 });
    notify({ tone: 'success', title: '文本已清洗', detail: '下一步：分析资料' });
  };

  const analyzeText = async () => {
    if (!currentImage) return notify({ tone: 'error', title: '请先粘贴截图。' });
    if (!manualText.trim()) return notify({ tone: 'error', title: '请粘贴识别文本后再分析。' });
    if (manualText.replace(/\s/g, '').length < 6) return notify({ tone: 'error', title: '文本太少，无法分析。你可以继续手动补充。' });
    setBusy(true);
    try {
      await saveOcrText(currentImage.id, { text: manualText.trim(), status: 'manual_fallback', language: 'auto' }).catch(() => undefined);
      const result = await previewOcrDraft({ fileId: currentImage.id, text: manualText.trim(), designType: task.designType });
      setPreview(result);
      setPreviewOpen(true);
      setWizardTask({ ...task, text: manualText.trim(), step: 3, designType: task.designType });
      notify({ tone: 'success', title: '资料卡片分析成功', detail: '下一步：生成草稿 / 修改资料类型 / 修改字段' });
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '文本太少，无法分析。你可以继续手动补充。') }); }
    finally { setBusy(false); }
  };

  const updatePreviewAsset = (field: keyof AnyAsset | string, value: string) => {
    if (!preview) return;
    const listFields = ['tags','aliases','relatedFactionIds','relatedDistrictIds','relatedPoiIds','relatedCharacterIds','relatedStorylineIds','linkedFiles'];
    setPreview({ ...preview, asset: { ...preview.asset, [field]: listFields.includes(field) ? value.split(/[，,]/).map((item) => item.trim()).filter(Boolean) : value } });
  };

  const generateDraft = async () => {
    if (!currentImage) return notify({ tone: 'error', title: '请先粘贴截图。' });
    if (!manualText.trim()) return notify({ tone: 'error', title: '请粘贴识别文本后再分析。' });
    setBusy(true);
    try {
      const result = await createOcrDraft({ fileId: currentImage.id, text: manualText.trim(), cleanedText: manualText.trim(), designType: task.designType, asset: preview?.asset });
      setDrafts((current) => [result.draft, ...current.filter((draft) => draft.id !== result.draft.id)]);
      setSelectedDraftIds([result.draft.id]);
      setHighlightDraftId(result.draft.id);
      setDraftFilter('current');
      setShowAllDrafts(false);
      setWizardTask({ ...task, step: 3, draftId: result.draft.id, text: manualText.trim() });
      setPreviewOpen(false);
      notify({ tone: 'success', title: '草稿生成成功', detail: '去审核草稿 / 继续粘贴下一张截图 / 查看本地资料库' });
      setTimeout(scrollToDrafts, 120);
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '生成草稿失败。') }); }
    finally { setBusy(false); }
  };

  const uploadEvidence = async (fileList: FileList | null) => {
    if (!fileList?.length || !apiOnline) return;
    setBusy(true);
    try {
      const uploaded = await uploadFiles(fileList, { fileUsage: 'intake_queue', tags: ['intake'] });
      onFilesChanged([...uploaded, ...files]);
      setQueueIds((current) => [...new Set([...uploaded.map((file) => file.id), ...current])]);
      setSelectedId(uploaded[0]?.id || selectedId);
      notify({ tone: 'success', title: '证物已加入解析队列。', detail: uploaded.map((file) => `${file.name} · ${formatSize(file.size)}`).join('\n') });
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '上传失败。') }); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const parseAdvanced = async () => {
    if (!apiOnline || !selectedFile) return;
    setBusy(true);
    try {
      const response = await parseIntakeFile({ fileId: selectedFile.id, parserMode: isImage(selectedFile) ? 'Image Evidence' : 'Auto Detect', targetType: 'characters', template: 'story_npc', createDrafts: true });
      setAdvancedMessage(response.message || `已解析 ${response.drafts.length} 条草稿。`);
      if (response.drafts.length) {
        const saved = await saveIntakeDrafts(response.drafts);
        setDrafts((current) => [...saved, ...current]);
        setSelectedDraftIds(saved.map((draft) => draft.id));
      }
    } catch (error) { setAdvancedMessage(archiveErrorMessage(error, '创建解析草稿失败。')); }
    finally { setBusy(false); }
  };

  const fileDraftNow = async (draft: IntakeDraft, mergeIntoId?: string) => {
    try {
      const result = await fileIntakeDraft(draft.id, mergeIntoId ? { mergeIntoId } : undefined);
      setDrafts((current) => current.map((item) => item.id === result.draft.id ? result.draft : item));
      setLastFiledAssetId(result.asset.id);
      const nextBundle = await fetchAssetBundle();
      onAssetsChanged(nextBundle);
      notify({ tone: 'success', title: '草稿入库成功', detail: '查看新档案 / 继续处理下一条 / 返回证物接收台' });
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '草稿入库失败。') }); }
  };

  const rejectDraftNow = async (draft: IntakeDraft) => {
    try { await rejectIntakeDraft(draft.id); setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, status: 'rejected' } : item)); notify({ tone: 'success', title: '草稿已驳回。' }); }
    catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '驳回失败。') }); }
  };

  const saveDraftEdit = async () => {
    if (!editing) return;
    try { const saved = await updateIntakeDraft(editing.id, editing); setDrafts((current) => current.map((draft) => draft.id === saved.id ? saved : draft)); setEditing(null); notify({ tone: 'success', title: '草稿已更新。' }); }
    catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '保存草稿失败。') }); }
  };

  const openPreflight = async () => { if (apiOnline && selectedDraftIds.length) setPreflight(await preflightIntake(selectedDraftIds)); };
  const fileBatch = async (onlyNoDuplicates = false) => {
    if (!apiOnline || !selectedDraftIds.length) return;
    try {
      const result = await fileIntakeDraftBatchSafe(selectedDraftIds, onlyNoDuplicates ? preflight?.duplicateDraftIds || [] : []);
      setPreflight(null);
      setDrafts((current) => current.map((draft) => selectedDraftIds.includes(draft.id) ? { ...draft, status: 'filed' } : draft));
      onAssetsChanged(await fetchAssetBundle());
      notify({ tone: 'success', title: '批量入库完成。', detail: `已入库 ${result.filed.length} 条。` });
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '批量入库失败。') }); }
  };
  const cleanDrafts = async (mode: 'rejected' | 'filed' | 'source' | 'projectx_test' | 'all') => {
    if (mode === 'all' && !window.confirm('二次确认：清空全部解析草稿？正式档案和 uploads 文件不会删除。')) return;
    const result = await cleanIntakeDrafts({ mode, sourceFileName: mode === 'source' ? currentImage?.name : undefined });
    setDrafts(await listIntakeDrafts());
    notify({ tone: 'success', title: '草稿已清理。', detail: `移除 ${result.removed} 条，剩余 ${result.remaining} 条。` });
  };
  const mergeDraftWith = async (draft: IntakeDraft, targetId: string) => {
    try { await mergeDossiers({ sourceDraftId: draft.id, targetId, targetType: draft.targetType, summaryMode: 'append', detailsMode: 'append' }); setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, status: 'merged' } : item)); onAssetsChanged(await fetchAssetBundle()); notify({ tone: 'success', title: '草稿已合并入档案。' }); }
    catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '合并失败。') }); }
  };

  const StepBadge = ({ step, label }: { step: WizardStep; label: string }) => <span className={`rounded-full border px-3 py-1 font-mono text-xs ${task.step === step ? 'border-crimson bg-crimson/10 text-crimson' : task.step > step ? 'border-teal/50 bg-teal/5 text-teal' : 'border-walnut/20 bg-paper text-walnut/60'}`}>{step} {label}</span>;
  const renderDraftCard = (draft: IntakeDraft) => {
    const completeness = getCompleteness(draft.asset, files);
    const dupes = detectDuplicates(draft.asset, allAssets);
    const source = files.find((file) => file.id === draft.sourceFileId || file.filename === draft.sourceFileId);
    const highlighted = draft.id === highlightDraftId;
    return <div key={draft.id} className={`border p-3 transition ${highlighted ? 'border-crimson bg-crimson/10 shadow-lg shadow-crimson/10' : draft.status === 'filed' ? 'border-teal/50 bg-teal/5' : draft.status === 'rejected' ? 'border-crimson/30 bg-burgundy/5 opacity-70' : 'border-walnut/20 bg-espresso/5'}`}>
      <div className="flex items-start justify-between gap-3"><div><label className="mb-1 flex items-center gap-2 font-mono text-xs text-walnut/70"><input type="checkbox" disabled={draft.status !== 'needs_review'} checked={selectedDraftIds.includes(draft.id)} onChange={(e) => setSelectedDraftIds((current) => e.target.checked ? [...new Set([...current, draft.id])] : current.filter((id) => id !== draft.id))} /> 选择草稿</label><p className="type-label text-crimson">{highlighted ? '新生成草稿 · ' : ''}{assetTypeLabels[draft.targetType]} · {statusLabel(draft.status)}</p><h4 className="font-display text-xl text-espresso">{draft.asset.name || '未命名草稿'}</h4><p className="text-xs text-walnut/60">来源文件： {draft.sourceFileName}</p></div><span className="stamp border-brass text-brass">{completeness.score}%</span></div>
      {source && isImage(source) ? <button onClick={() => setLightboxFile(source)} className="mt-3 w-full border border-walnut/20 bg-paper p-1"><img src={source.url} alt={source.name} className="h-28 w-full object-cover sepia" /></button> : null}
      {dupes.length ? <div className="mt-2 border border-crimson/50 bg-crimson/10 p-2 font-mono text-xs text-crimson">重复提醒： {dupes.map((hit) => hit.asset.name).join(', ')}</div> : null}
      <p className="mt-2 line-clamp-3 text-sm text-walnut/75">{String(draft.asset.summary || draft.asset.details || '暂无摘要。')}</p>
      <div className="mt-3 flex flex-wrap gap-2"><button className="stamp border-brass text-brass" onClick={() => setEditing(draft)}>编辑草稿</button><button className="stamp border-brass text-brass" onClick={() => setJsonPreview(draft)}>预览 JSON</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!apiOnline || draft.status !== 'needs_review'} onClick={() => void fileDraftNow(draft)}>审核草稿</button><button className="stamp border-brass text-brass disabled:opacity-50" disabled={!apiOnline || !dupes.length || draft.status !== 'needs_review'} onClick={() => void mergeDraftWith(draft, dupes[0]?.asset.id)}>合并入档</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!apiOnline || draft.status !== 'needs_review'} onClick={() => void rejectDraftNow(draft)}>驳回</button></div>
    </div>;
  };

  return (
    <section className="space-y-6 pb-28">
      <div className="border border-brass/25 bg-walnut/40 p-4"><p className="type-label text-brass">EVIDENCE ROOM</p><h2 className="font-display text-3xl text-ivory">证物接收台</h2></div>

      {showResume ? <div className="dossier-panel border-crimson/40 bg-crimson/5 p-4"><p className="font-bold text-espresso">发现未完成的截图入库任务，是否继续？</p><div className="mt-3 flex gap-2"><button className="stamp border-crimson text-crimson" onClick={() => { setShowResume(false); scrollToWizard(); }}>继续</button><button className="stamp border-brass text-brass" onClick={() => { setShowResume(false); abandonTask(); }}>放弃</button></div></div> : null}

      <div ref={wizardRef} className="dossier-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brass/30 pb-4"><div><p className="type-label text-crimson">截图入库向导</p><h3 className="font-display text-2xl text-espresso">截图 → Windows OCR / 手动粘贴 → 字段校对 → 生成草稿</h3></div><div className="flex flex-wrap items-center gap-2"><StepBadge step={1} label="粘贴截图" /><span className="text-walnut/40">→</span><StepBadge step={2} label="识别文字" /><span className="text-walnut/40">→</span><StepBadge step={3} label="生成草稿" /></div></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="border border-brass/25 bg-paper/70 p-4"><p className="type-label text-crimson">当前截图</p>{currentImage ? <><button className="mt-2 w-full border border-walnut/20 bg-paper p-2" onClick={() => setLightboxFile(currentImage)}><img src={currentImage.url} alt={currentImage.name} className="max-h-72 w-full object-contain sepia" /></button><p className="mt-2 break-all text-xs text-walnut/70">{currentImage.name}</p><p className="text-xs text-walnut/60">来源：剪贴板截图 / Evidence</p></> : <p className="mt-3 border border-dashed border-walnut/30 bg-espresso/5 p-4 text-sm text-walnut/60">请先粘贴截图。</p>}<div className="mt-3 flex flex-wrap gap-2"><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={busy || !apiOnline} onClick={() => void pasteScreenshot()}>粘贴截图</button>{currentImage ? <button className="stamp border-brass text-brass" onClick={() => setLightboxFile(currentImage)}>查看原图</button> : null}</div><p className="mt-2 text-xs text-walnut/70">使用 Windows 截图或 Snipaste 后，回到这里按 Ctrl+V。截图保存成功后会自动进入步骤 2。</p></div>
          <div className="grid gap-4">
            <div className="border border-brass/25 bg-paper/70 p-4"><p className="type-label text-crimson">识别文本</p><textarea className="paper-input mt-3 min-h-52" placeholder="粘贴文本：把外部 OCR 识别结果贴在这里。" value={manualText} onChange={(e) => setWizardTask({ ...task, text: e.target.value })} /><div className="mt-3 flex flex-wrap gap-2"><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!currentImage || busy} onClick={() => void runWindowsOcrForCurrentImage()}>自动识别文字</button><button className="stamp border-brass text-brass disabled:opacity-50" disabled={!currentImage || !manualText.trim() || busy} onClick={() => void saveText()}>手动粘贴文本</button><button className="stamp border-brass text-brass disabled:opacity-50" disabled={!manualText.trim() || busy} onClick={cleanText}>清洗文本</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!currentImage || !manualText.trim() || busy} onClick={() => void analyzeText()}>分析资料</button></div>{!manualText.trim() ? <p className="mt-2 text-xs text-crimson">请粘贴识别文本后再分析。</p> : <p className="mt-2 text-xs text-walnut/70">文本保存成功后，下一步：分析资料卡片；也可以返回修改文本。</p>}</div>
            <div className="border border-brass/25 bg-paper/70 p-4"><p className="type-label text-crimson">资料卡片</p><div className="mt-3 grid gap-3 md:grid-cols-2"><label><span className="field-label">资料类型</span><select className="paper-input" value={task.designType} onChange={(e) => setWizardTask({ ...task, designType: e.target.value })}>{types.length ? types.map((item) => <option key={item.id} value={item.id}>{item.label}</option>) : <option value="other_design">其他资料</option>}</select></label><div className="border border-walnut/20 bg-espresso/5 p-3 text-sm text-walnut/70">{preview ? <>已生成资料卡片预览：{assetTypeLabels[preview.targetType]} · {String(preview.asset.name || '未命名')}</> : '还没有生成草稿。请先点击“分析资料”。'}</div></div><div className="mt-3 flex flex-wrap gap-2"><button className="stamp border-brass text-brass disabled:opacity-50" disabled={!preview} onClick={() => setPreviewOpen(true)}>修改字段</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!currentImage || !manualText.trim() || busy} onClick={() => preview ? void generateDraft() : void analyzeText()}>生成草稿</button>{task.draftId ? <button className="stamp border-brass text-brass" onClick={scrollToDrafts}>审核草稿</button> : null}</div></div>
          </div>
        </div>
      </div>

      <details className="dossier-panel p-5"><summary className="cursor-pointer font-display text-xl text-espresso">高级功能 / 传统解析队列（默认收起）</summary><div className="mt-4 grid gap-5 xl:grid-cols-2"><div><p className="type-label text-crimson">截图证物 / 文件上传</p><input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => void uploadEvidence(e.target.files)} /><div className="mt-3 flex flex-wrap gap-2"><button className="stamp border-brass text-brass" onClick={() => inputRef.current?.click()}>上传证物</button><button className="stamp border-brass text-brass" onClick={() => void pasteScreenshot()}>粘贴截图</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!selectedFile || busy} onClick={() => void parseAdvanced()}>生成草稿</button></div><div className="mt-3 grid gap-2">{files.filter((file) => queueIds.includes(file.id)).slice(0, 8).map((file) => <button key={file.id} className={`border p-2 text-left text-sm ${selectedFile?.id === file.id ? 'border-crimson bg-crimson/10' : 'border-walnut/20 bg-paper/70'}`} onClick={() => setSelectedId(file.id)}>{file.name} · {formatSize(file.size)}</button>)}</div></div><div><p className="type-label text-crimson">解析提示</p><p className="mt-3 border border-brass/20 bg-brass/10 p-3 text-sm text-walnut/75">{advancedMessage || '高级入口保留原有 Evidence Intake 能力；默认收起，避免打断截图入库向导。'}</p><p className="mt-3 text-xs text-walnut/60">可用模板：{dossierTemplates.map((item) => item.chineseName).join(' / ')}</p></div></div></details>

      <div ref={draftRef} className="dossier-panel p-5"><div className="sticky top-0 z-10 mb-4 border-b border-brass/30 bg-paper/95 pb-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="type-label text-crimson">最近待审核</p><h3 className="font-display text-2xl text-espresso">审核草稿</h3><p className="text-xs text-walnut/65">默认只显示最近 6 条待处理草稿，降低页面负担。</p></div><div className="flex flex-wrap gap-2"><button className="stamp border-brass text-brass" onClick={() => setSelectedDraftIds(filteredDrafts.filter((draft) => draft.status === 'needs_review').map((draft) => draft.id))}>选择当前</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!apiOnline || !selectedDraftIds.length} onClick={() => void openPreflight()}>批量入库预检查</button></div></div><div className="mt-3 flex flex-wrap gap-2"><button className={`stamp ${draftFilter === 'recent' ? 'border-crimson text-crimson' : 'border-brass text-brass'}`} onClick={() => setDraftFilter('recent')}>最近待审核</button><button className={`stamp ${draftFilter === 'current' ? 'border-crimson text-crimson' : 'border-brass text-brass'}`} onClick={() => setDraftFilter('current')}>只看当前截图相关</button><button className={`stamp ${draftFilter === 'today' ? 'border-crimson text-crimson' : 'border-brass text-brass'}`} onClick={() => setDraftFilter('today')}>今日创建</button><button className={`stamp ${draftFilter === 'unreviewed' ? 'border-crimson text-crimson' : 'border-brass text-brass'}`} onClick={() => setDraftFilter('unreviewed')}>未审核</button><button className={`stamp ${draftFilter === 'generated' ? 'border-crimson text-crimson' : 'border-brass text-brass'}`} onClick={() => setDraftFilter('generated')}>已生成但未入库</button><button className="stamp border-brass text-brass" onClick={() => setShowAllDrafts((value) => !value)}>{showAllDrafts ? '收起' : '查看全部'}</button></div></div><div className="mb-3 flex flex-wrap gap-2 border border-brass/20 bg-walnut/10 p-2"><button className="stamp border-brass text-brass" onClick={() => void cleanDrafts('rejected')}>清理已驳回草稿</button><button className="stamp border-brass text-brass" onClick={() => void cleanDrafts('filed')}>清理已入库/合并草稿</button><button className="stamp border-brass text-brass" disabled={!currentImage} onClick={() => void cleanDrafts('source')}>清理当前来源草稿</button><button className="stamp border-crimson text-crimson" onClick={() => void cleanDrafts('all')}>清空全部草稿</button></div>{filteredDrafts.length > 6 && !showAllDrafts ? <p className="mb-3 border border-brass/20 bg-brass/10 p-2 text-xs text-walnut/70">已折叠 {filteredDrafts.length - 6} 条草稿。点击“查看全部待审核草稿 / 查看全部”展开。</p> : null}<div className="grid gap-4 xl:grid-cols-2">{visibleDrafts.length === 0 ? <p className="border border-dashed border-walnut/30 bg-espresso/5 p-4 text-sm text-walnut/60">还没有生成草稿。</p> : visibleDrafts.map(renderDraftCard)}</div>{lastFiledAssetId ? <div className="mt-4 flex flex-wrap gap-2 border border-teal/30 bg-teal/5 p-3"><span className="text-sm font-bold text-teal">草稿入库成功</span><button className="stamp border-brass text-brass" onClick={() => window.dispatchEvent(new CustomEvent('projectx:navigate', { detail: { view: 'library', id: lastFiledAssetId } }))}>查看本地资料库</button><button className="stamp border-brass text-brass" onClick={abandonTask}>继续下一条</button><button className="stamp border-brass text-brass" onClick={scrollToWizard}>返回证物接收台</button></div> : null}</div>

      <div className="mt-6 border border-brass/25 bg-espresso/5 p-4"><p className="type-label text-crimson">导入历史</p><div className="mt-2 grid gap-2 md:grid-cols-2">{history.slice(0, 6).map((item) => <div key={item.id} className="border border-walnut/20 bg-paper/60 p-2 text-xs text-walnut/75"><p>{new Date(item.createdAt).toLocaleString()} · {item.sourceFileName}</p><p>入库 {item.filedCount} 条：{item.filedAssetNames?.join(' / ')}</p><p>备份：{item.backupFileName}</p></div>)}</div></div>

      {hasTask ? <div className="fixed bottom-5 right-5 z-40 w-[min(22rem,calc(100vw-2rem))] border border-brass/40 bg-paper/95 p-3 shadow-2xl backdrop-blur"><div className="flex items-start justify-between gap-3"><div><p className="type-label text-crimson">当前处理任务</p><p className="font-display text-lg text-espresso">步骤 {task.step} · {task.step === 1 ? '粘贴截图' : task.step === 2 ? '粘贴文本' : '生成草稿'}</p></div><button className="stamp border-brass text-brass" onClick={() => setFloatingMinimized((value) => !value)}>{floatingMinimized ? '展开' : '最小化'}</button></div>{!floatingMinimized ? <><div className="mt-2 grid grid-cols-[5rem_1fr] gap-3 text-xs text-walnut/70">{currentImage ? <img src={currentImage.url} alt={currentImage.name} className="h-20 w-20 border border-walnut/20 object-cover sepia" /> : <div className="grid h-20 w-20 place-items-center border border-dashed border-walnut/30">无图</div>}<div className="space-y-1"><p>当前资料类型：{currentType?.label || '未选择'}</p><p>是否已有识别文本：{manualText.trim() ? '是' : '否'}</p><p>是否已生成草稿：{task.draftId ? '是' : '否'}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><button className="stamp border-brass text-brass" onClick={scrollToWizard}>返回当前任务</button><button className="stamp border-crimson text-crimson" onClick={() => { if (task.step < 3) scrollToWizard(); else scrollToDrafts(); }}>继续下一步</button><button className="stamp border-brass text-brass" onClick={abandonTask}>放弃当前任务</button>{currentImage ? <button className="stamp border-brass text-brass" onClick={() => setLightboxFile(currentImage)}>查看原图</button> : null}</div></> : null}</div> : null}

      {previewOpen && preview ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="dossier-panel max-h-[90vh] w-full max-w-4xl overflow-auto p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="type-label text-crimson">资料卡片</p><h3 className="font-display text-2xl text-espresso">资料卡片预览（生成草稿前请确认）</h3></div><button className="stamp border-brass text-brass" onClick={() => setPreviewOpen(false)}>关闭</button></div><div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]"><div className="border border-walnut/20 bg-paper p-3">{currentImage ? <img src={currentImage.url} alt={currentImage.name} className="max-h-72 w-full object-contain sepia" /> : null}<p className="mt-2 text-xs text-walnut/60">未识别文本</p><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap border border-walnut/20 bg-espresso/5 p-2 text-xs text-walnut/75">{preview.unrecognizedText || '无'}</pre></div><div className="grid gap-2 text-sm"><label>资料类型<select className="paper-input" value={task.designType} onChange={(e) => setWizardTask({ ...task, designType: e.target.value })}>{types.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>名称<input className="paper-input" value={String(preview.asset.name || '')} onChange={(e) => updatePreviewAsset('name', e.target.value)} /></label><label>简介<textarea className="paper-input min-h-20" value={String(preview.asset.summary || '')} onChange={(e) => updatePreviewAsset('summary', e.target.value)} /></label><label>详情<textarea className="paper-input min-h-28" value={String(preview.asset.details || '')} onChange={(e) => updatePreviewAsset('details', e.target.value)} /></label><label>标签<input className="paper-input" value={Array.isArray(preview.asset.tags) ? preview.asset.tags.join('，') : String(preview.asset.tags || '')} onChange={(e) => updatePreviewAsset('tags', e.target.value)} /></label></div></div><details className="mt-3"><summary className="font-bold text-espresso">字段列表</summary><ul className="mt-2 list-disc pl-5 text-sm text-walnut/75">{preview.recognizedFields.length ? preview.recognizedFields.map((item, index) => <li key={`${item.field}-${index}`}>{item.label} → {item.field}: {item.value}</li>) : <li>暂无明确字段，请返回修改文本。</li>}</ul></details><div className="mt-4 flex flex-wrap justify-end gap-2"><button className="stamp border-brass text-brass" onClick={() => setPreviewOpen(false)}>关闭</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={busy} onClick={() => void generateDraft()}>生成草稿</button></div></div></div> : null}

      {preflight ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="dossier-panel max-h-[90vh] w-full max-w-3xl overflow-auto p-5"><p className="type-label text-crimson">入库预检查</p><h3 className="font-display text-2xl text-espresso">即将入库 {preflight.draftCount} 条草稿</h3><div className="mt-3 border border-brass/30 bg-brass/10 p-3 text-sm text-walnut/80"><p>可能重复：{preflight.duplicateCount} 条；缺失关键字段：{preflight.missingNameCount} 条；证物绑定：{preflight.evidenceBindings} 个。</p><p>备份文件名预览：{preflight.backupPreview}</p></div><div className="mt-4 flex flex-wrap justify-end gap-2"><button className="stamp border-brass text-brass" onClick={() => setPreflight(null)}>返回修改</button><button className="stamp border-brass text-brass" onClick={() => void fileBatch(true)}>只入库无重复项</button><button className="stamp border-crimson text-crimson" onClick={() => void fileBatch(false)}>确认入库</button></div></div></div> : null}
      {editing ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="dossier-panel max-h-[90vh] w-full max-w-3xl overflow-auto p-5"><p className="type-label text-crimson">编辑草稿</p><input className="paper-input mt-3" value={editing.asset.name || ''} onChange={(e) => setEditing({ ...editing, asset: { ...editing.asset, name: e.target.value } })} /><textarea className="paper-input mt-3 min-h-24" value={editing.asset.summary || ''} onChange={(e) => setEditing({ ...editing, asset: { ...editing.asset, summary: e.target.value } })} /><textarea className="paper-input mt-3 min-h-48" value={editing.asset.details || ''} onChange={(e) => setEditing({ ...editing, asset: { ...editing.asset, details: e.target.value } })} /><div className="mt-4 flex justify-end gap-2"><button className="stamp border-brass text-brass" onClick={() => setEditing(null)}>取消</button><button className="stamp border-crimson text-crimson" onClick={() => void saveDraftEdit()}>保存草稿</button></div></div></div> : null}
      {jsonPreview ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="dossier-panel max-h-[90vh] w-full max-w-3xl overflow-auto p-5"><p className="type-label text-crimson">预览 JSON</p><pre className="mt-3 overflow-auto border border-walnut/20 bg-espresso/10 p-3 text-xs text-walnut">{JSON.stringify(jsonPreview.asset, null, 2)}</pre><div className="mt-4 text-right"><button className="stamp border-brass text-brass" onClick={() => setJsonPreview(null)}>关闭</button></div></div></div> : null}
      {lightboxFile ? <EvidenceLightbox image={lightboxFile} imageList={imageFiles} initialIndex={Math.max(0, imageFiles.findIndex((file) => file.id === lightboxFile.id))} assets={allAssets} onClose={() => setLightboxFile(null)} apiOnline={apiOnline} notify={notify} onDraftCreated={(draft) => { setDrafts((current) => [draft, ...current]); setHighlightDraftId(draft.id); }} /> : null}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { IntakeDraft, OcrDesignType, OcrDraftPreview, OcrProviderStatus, OcrResult, UploadedFileRecord } from '../../utils/api';
import { ApiError, archiveErrorMessage, createOcrDraft, getOcrEngineStatus, getOcrResult, listOcrDesignTypes, previewOcrDraft, runOcr, saveOcrText } from '../../utils/api';
import type { ArchiveNotifier } from '../ui/ArchiveNotice';

const languageOptions = [
  { value: 'auto', label: '自动（中英混合）' },
  { value: 'chi_sim', label: '中文' },
  { value: 'eng', label: '英文' },
  { value: 'chi_sim+eng', label: '中英混合' },
];
const preprocessOptions = [
  { value: 'original', label: '使用原图' },
  { value: 'grayscale', label: '灰度识别' },
  { value: 'contrast', label: '提高对比度' },
  { value: 'scale2', label: '放大 2 倍' },
  { value: 'scale3', label: '放大 3 倍' },
  { value: 'gray_contrast_scale2', label: '灰度 + 对比度 + 放大 2 倍' },
  { value: 'gray_contrast_scale3', label: '灰度 + 对比度 + 放大 3 倍' },
];
const providerOptions = [
  { value: 'auto', label: '自动推荐' },
  { value: 'winocr-powershell', label: 'Windows OCR' },
  { value: 'paddleocr-http', label: 'PaddleOCR 本地服务' },
  { value: 'paddleocr-cli', label: 'PaddleOCR 命令行' },
  { value: 'tesseract-cli', label: 'Tesseract 便携版' },
  { value: 'manual-fallback', label: '手动粘贴' },
];
const providerLabel = (id?: string) => providerOptions.find((item) => item.value === id)?.label || id || '自动推荐';
const psmOptions = [
  { value: 'auto', label: '自动' },
  { value: 'block', label: '单块文本' },
  { value: 'column', label: '单列文本' },
  { value: 'line', label: '单行文本' },
  { value: 'sparse', label: '稀疏文本' },
  { value: 'card', label: '表格/设定卡' },
];
const qualityHint = '识别结果可能不准确。建议尝试：放大 2 倍、提高对比度、选择中文模式，或手动粘贴文本。';
const fieldLinePattern = /^\s*[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z\s]{0,32}\s*[:：=]/u;
const cleanOcrText = (value: string) => {
  const fixed = value
    .replace(/\s*[:：=]\s*/g, '：')
    .replace(/姓\s+名/g, '姓名')
    .replace(/英\s+文\s+名/g, '英文名')
    .replace(/简\s+介/g, '简介')
    .replace(/职\s+业/g, '职业')
    .replace(/标\s+签/g, '标签');
  const lines = fixed.split(/\r?\n/).map((line) => line.trim()).filter((line, index, all) => {
    if (/^[A-Za-z]$/.test(line)) return false;
    return line || (index > 0 && all[index - 1].trim());
  });
  const merged: string[] = [];
  for (const line of lines) {
    if (!line) { if (merged[merged.length - 1]) merged.push(''); continue; }
    const previous = merged[merged.length - 1];
    const canMerge = previous && !fieldLinePattern.test(previous) && !fieldLinePattern.test(line) && !/[。！？.!?：:]$/.test(previous) && line.length < 48;
    if (canMerge) merged[merged.length - 1] = `${previous}${/[\p{Script=Han}]$/u.test(previous) || /^[\p{Script=Han}]/u.test(line) ? '' : ' '}${line}`;
    else merged.push(line);
  }
  return merged.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
const statusLabel: Record<string, string> = { none: '未识别', queued: '排队中', processing: '识别中', done: '识别完成', failed: '识别失败', manual: '手动文本', manual_fallback: '手动识别文本' };
const isImage = (file: UploadedFileRecord) => file.folder === 'images' || file.type?.startsWith('image/');
const hasLocalQualityWarning = (value: string, lang: string) => {
  const compact = value.replace(/\s+/g, '');
  if (compact.length > 0 && compact.length < 5) return true;
  const han = compact.match(/[\p{Script=Han}]/gu)?.length || 0;
  const latin = compact.match(/[A-Za-z]/g)?.length || 0;
  const isolatedLatinLines = value.split(/\r?\n/).filter((line) => /^[A-Za-z]$/.test(line.trim())).length;
  const mojibake = compact.match(/[�□■]|[\u0080-\u009f]/g)?.length || 0;
  return (lang === 'chi_sim' && (latin > Math.max(12, han * 1.4) || han < 3)) || isolatedLatinLines >= 4 || mojibake >= 2;
};
const fallbackStatusFromError = (message: string) => message.includes('权限') || message.includes('安全策略') || message.includes('拦截') ? 'OCR 被系统拦截，可手动粘贴' : 'OCR 不可用，可手动粘贴';

export function OcrResultEditor({ file, apiOnline, notify, onDraftCreated }: { file: UploadedFileRecord; apiOnline: boolean; notify?: ArchiveNotifier; onDraftCreated?: (draft: IntakeDraft) => void }) {
  const [ocr, setOcr] = useState<OcrResult>({ sourceFileId: file.id, sourceFileName: file.name, status: 'none', text: '' });
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('auto');
  const [provider, setProvider] = useState('auto');
  const [preprocess, setPreprocess] = useState('scale2');
  const [psmMode, setPsmMode] = useState('block');
  const [designType, setDesignType] = useState('other_design');
  const [previewMode, setPreviewMode] = useState<'card' | 'mind'>('card');
  const [types, setTypes] = useState<OcrDesignType[]>([]);
  const [busy, setBusy] = useState(false);
  const [hasRunAttempt, setHasRunAttempt] = useState(false);
  const runningRef = useRef(false);
  const [message, setMessage] = useState('OCR 结果不会直接入库，请在草稿区确认。');
  const [engineStatus, setEngineStatus] = useState('OCR 不可用，可手动粘贴');
  const [activeProvider, setActiveProvider] = useState('manual-fallback');
  const [providerStatuses, setProviderStatuses] = useState<OcrProviderStatus[]>([]);
  const [languageStatus, setLanguageStatus] = useState<{ eng?: boolean; chi_sim?: boolean }>({});
  const [cleanUndo, setCleanUndo] = useState<string | null>(null);
  const [preview, setPreview] = useState<OcrDraftPreview | null>(null);

  useEffect(() => {
    if (!apiOnline) return;
    let cancelled = false;
    setHasRunAttempt(false);
    void getOcrResult(file.id).then((result) => { if (!cancelled) { setOcr(result); setText(result.text || ''); setLanguage(result.language || 'auto'); setPreprocess(result.preprocess || 'scale2'); setPsmMode(result.psmMode || 'block'); if (result.activeProvider || result.engine) setActiveProvider(result.activeProvider || result.engine || 'manual-fallback'); if (result.engineStatus || result.statusLabel) setEngineStatus(result.engineStatus || result.statusLabel || 'OCR 不可用，可手动粘贴'); } }).catch(() => undefined);
    void getOcrEngineStatus().then((status) => { if (!cancelled) { setEngineStatus(status.statusLabel || status.message || 'OCR 不可用，可手动粘贴'); setActiveProvider(status.activeProvider || status.engine || 'manual-fallback'); setProviderStatuses(status.providers || []); setLanguageStatus(status.languageStatus || { eng: status.languages.includes('eng'), chi_sim: status.languages.includes('chi_sim') }); if (status.languageWarnings?.length) setMessage(status.languageWarnings.join(' ')); } }).catch(() => { if (!cancelled) setEngineStatus('OCR 不可用，可手动粘贴'); });
    void listOcrDesignTypes().then((items) => { if (!cancelled) setTypes(items); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [apiOnline, file.id]);

  const run = async (providerOverride?: string) => {
    if (runningRef.current) return;
    if (!apiOnline || !isImage(file)) { setMessage('当前文件不是图片，无法 OCR。'); return; }
    runningRef.current = true;
    setHasRunAttempt(true);
    setBusy(true); setMessage('识别中 · 请等待本地 OCR 引擎处理，结果需要人工校对。');
    try {
      const selectedProvider = providerOverride || provider;
      if (selectedProvider === 'manual-fallback') { setMessage('已切换到手动粘贴模式：请粘贴外部 OCR 文本，清洗、保存后生成草稿。'); return; }
      const result = await runOcr({ fileId: file.id, language: providerOverride === 'winocr-powershell' ? 'zh-Hans' : language, preprocess, psmMode, provider: selectedProvider });
      setOcr(result); setText(result.text || ''); if (result.activeProvider || result.engine) setActiveProvider(result.activeProvider || result.engine || activeProvider); if (result.providers?.length) setProviderStatuses(result.providers); if (result.engineStatus || result.statusLabel) setEngineStatus(result.engineStatus || result.statusLabel || 'OCR 不可用，可手动粘贴');
      const qualityWarnings = result.qualityWarnings?.length ? result.qualityWarnings.join(' ') : (result.text && hasLocalQualityWarning(result.text, language) ? qualityHint : '');
      const friendly = result.text ? (selectedProvider === 'winocr-powershell' || result.activeProvider === 'winocr-powershell' ? 'Windows OCR 已识别，请校对后继续。' : `识别完成。实际预处理：${result.preprocessLabel || result.preprocess || preprocess}；识别版式：${result.psmLabel || psmMode}。${qualityWarnings ? ` ${qualityWarnings}` : ' 请先校对识别文本，再生成草稿。'}`) : result.error || '没有识别到文字，请尝试更清晰的图片，或手动粘贴文本。';
      setMessage(friendly);
      notify?.({ tone: result.status === 'done' ? 'success' : 'info', title: result.status === 'done' ? 'OCR 识别完成' : friendly, detail: result.status === 'done' ? file.name : undefined });
    } catch (error) {
      const friendly = archiveErrorMessage(error, 'OCR 请求失败，请检查本地服务。');
      const engineLabel = fallbackStatusFromError(friendly);
      const body = error instanceof ApiError && typeof error.body === 'object' && error.body ? error.body as { engine?: string; status?: string; error?: string } : undefined;
      setEngineStatus(engineLabel);
      setOcr((current) => ({ ...current, status: body?.status === 'failed' ? 'failed' : current.status, engine: body?.engine || 'manual-fallback', activeProvider: body?.engine || 'manual-fallback', engineStatus: engineLabel, statusLabel: engineLabel, error: friendly }));
      const failureMessage = providerOverride === 'winocr-powershell' ? 'Windows OCR 识别失败，请手动粘贴识别文本。' : friendly;
      setMessage(failureMessage);
      notify?.({ tone: 'error', title: failureMessage });
    } finally { runningRef.current = false; setBusy(false); }
  };
  const cleanText = () => {
    setCleanUndo(text);
    setText(cleanOcrText(text));
    setPreview(null);
    setMessage('文本已清洗；请人工校对后点击“保存文本”，清洗不会自动生成草稿。');
  };
  const undoClean = () => {
    if (cleanUndo === null) return;
    setText(cleanUndo);
    setCleanUndo(null);
    setPreview(null);
    setMessage('已撤销上次清洗。');
  };
  const save = async () => {
    if (!apiOnline) return;
    setBusy(true);
    try { const result = await saveOcrText(file.id, { text, language, status: text.trim() ? 'manual' : 'none' }); setOcr(result); setMessage('识别文本已保存。'); notify?.({ tone: 'success', title: '识别文本已保存。' }); }
    catch (error) { const friendly = archiveErrorMessage(error, '保存识别文本失败。'); setMessage(friendly); notify?.({ tone: 'error', title: friendly }); }
    finally { setBusy(false); }
  };
  const makeDraft = async () => {
    if (!text.trim()) { setMessage('请先输入识别文本。'); return; }
    if (!designType) { setMessage('请选择资料类型。'); return; }
    setBusy(true);
    try {
      const result = await previewOcrDraft({ fileId: file.id, text, designType });
      setPreview(result);
      setMessage('草稿预览已生成。请确认字段与目标文件后再写入 Parsed Drafts。');
    } catch (error) { const friendly = archiveErrorMessage(error, '生成草稿预览失败。'); setMessage(friendly); notify?.({ tone: 'error', title: friendly }); }
    finally { setBusy(false); }
  };
  const confirmDraft = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await createOcrDraft({ fileId: file.id, text: ocr.text || cleanUndo || text, cleanedText: text, designType, asset: preview.asset });
      setPreview({ ...preview, ...result });
      onDraftCreated?.(result.draft);
      setMessage('草稿已写入 Parsed Drafts，请到解析草稿区确认。');
      notify?.({ tone: 'success', title: '草稿已写入 Parsed Drafts。', detail: `${result.draft.asset.name} · ${result.targetType}` });
    } catch (error) { const friendly = archiveErrorMessage(error, '生成草稿失败。'); setMessage(friendly); notify?.({ tone: 'error', title: friendly }); }
    finally { setBusy(false); }
  };


  const updatePreviewAsset = (field: string, value: string) => {
    setPreview((current) => current ? { ...current, asset: { ...current.asset, [field]: ['tags','relatedCharacterIds','relatedPoiIds','relatedFactionIds','relatedDistrictIds'].includes(field) ? value.split(/[，,、;；]/).map((item) => item.trim()).filter(Boolean) : value } } : current);
  };
  const previewAsset = preview?.asset || {};
  const winOcrStatus = providerStatuses.find((item) => item.id === 'winocr-powershell');
  const winOcrAvailable = Boolean(winOcrStatus?.available);
  const selectedProviderStatus = providerStatuses.find((item) => item.id === provider);
  const tesseractChineseTip = (activeProvider === 'tesseract-cli' || provider === 'tesseract-cli') && (language === 'chi_sim' || language === 'chi_sim+eng' || language === 'auto');

  return (
    <section className="border border-brass/30 bg-espresso/10 p-3 text-espresso">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="type-label text-crimson">外部 OCR 文本接收台</p><h3 className="font-display text-xl">粘贴识别文本</h3><p className="text-xs text-walnut/70">识别结果需要人工校对；OCR 结果不会直接入库。</p></div>
        <span className="stamp border-brass text-brass">{statusLabel[ocr.status] || ocr.status}</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[120px_1fr]">
        <img src={file.url} alt={file.name} className="h-28 w-28 border-4 border-paper object-cover shadow-noir" />
        <div className="grid gap-2 text-xs text-walnut/75"><span>文件名：{file.name}</span><span>OCR 语言：{ocr.language || language}</span><span>实际预处理：{ocr.preprocessLabel || preprocessOptions.find((item) => item.value === preprocess)?.label || preprocess}</span><span>识别版式：{ocr.psmLabel || psmOptions.find((item) => item.value === psmMode)?.label || psmMode}</span><span>置信度：{ocr.confidence ? `${(ocr.confidence * 100).toFixed(1)}%` : '暂无'}</span><span>当前引擎：{providerLabel(activeProvider)}</span><span>引擎状态：{ocr.engineStatus || ocr.statusLabel || engineStatus}</span><span>英文识别：{languageStatus.eng ? '可用' : '不可用'}</span><span>简体中文识别：{languageStatus.chi_sim ? '可用' : '不可用'}</span>{ocr.error ? <span className="text-crimson">{ocr.error}</span> : null}</div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        <label><span className="field-label">识别引擎</span><select className="paper-input" value={provider} onChange={(e) => { setProvider(e.target.value); setPreview(null); }}>{providerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="field-label">识别语言</span><select className="paper-input" value={language} onChange={(e) => setLanguage(e.target.value)}>{languageOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="field-label">图片预处理</span><select className="paper-input" value={preprocess} onChange={(e) => setPreprocess(e.target.value)}>{preprocessOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="field-label">识别版式</span><select className="paper-input" value={psmMode} onChange={(e) => setPsmMode(e.target.value)}>{psmOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="field-label">资料类型</span><select className="paper-input" value={designType} onChange={(e) => setDesignType(e.target.value)}>{types.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>
      <div className="mt-3 border border-brass/20 bg-paper/70 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold text-espresso">粘贴外部 OCR 文本</p><p className="text-xs text-walnut/75">可以使用 Windows 截图工具、Snipaste、Office、企业微信、飞书、钉钉或其他公司允许的工具提取文字，再粘贴到这里。</p></div><button className="stamp border-brass text-brass" type="button" onClick={() => setProvider('manual-fallback')}>切到手动粘贴</button></div><label className="mt-2 block"><span className="field-label">识别文本 · 外部 OCR / 手动粘贴</span><textarea className="paper-input min-h-44" value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} placeholder="可从 Windows 截图、Office、企业微信、飞书或其他公司工具复制 OCR 文本后粘贴到这里。" /></label></div>
      <p className="mt-2 border border-brass/20 bg-brass/10 p-2 text-xs text-walnut/75">中文截图优先使用 Windows OCR。自动推荐会按 Windows OCR → Tesseract → 手动粘贴 fallback；PaddleOCR / RapidOCR / EasyOCR 可保留但不作为当前公司环境默认优先。{selectedProviderStatus && provider !== 'auto' && !selectedProviderStatus.available ? '该 OCR 引擎不可用，请检查配置或改用手动粘贴。' : ''} {message}</p>
      {tesseractChineseTip ? <p className="mt-2 border border-crimson/30 bg-crimson/10 p-2 text-xs text-crimson">Tesseract 中文识别可能不稳定。复杂设定图建议使用 PaddleOCR 或粘贴外部 OCR 文本。</p> : null}
      {providerStatuses.length ? <div className="mt-2 grid gap-1 text-xs text-walnut/75 md:grid-cols-2">{providerStatuses.map((item) => <span key={item.id} className={item.available ? 'text-walnut/80' : 'text-walnut/50'}>{item.available ? '可用' : '不可用'} · {item.label}{item.message ? `：${item.message}` : ''}</span>)}</div> : null}
      {(ocr.qualityWarnings?.length || hasLocalQualityWarning(text, language)) ? <p className="mt-2 border border-crimson/30 bg-crimson/10 p-2 text-xs text-crimson">{ocr.qualityWarnings?.join(' ') || qualityHint}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {winOcrAvailable ? <button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!apiOnline || busy} onClick={() => void run('winocr-powershell')}>自动识别文字</button> : null}
        <button className="stamp border-brass text-brass disabled:opacity-50" disabled={!apiOnline || busy} onClick={() => { setProvider('manual-fallback'); setMessage('请在识别文本框中手动粘贴文本。'); }}>手动粘贴文本</button>
        <button className="stamp border-brass text-brass disabled:opacity-50" disabled={!apiOnline || busy} onClick={() => void run()}>{ocr.text || hasRunAttempt ? '重新识别' : '识别文字'}</button>
        <button className="stamp border-brass text-brass disabled:opacity-50" disabled={!apiOnline || busy} onClick={() => void save()}>保存文本</button>
        <button className="stamp border-brass text-brass disabled:opacity-50" disabled={busy || !text.trim()} onClick={cleanText}>清洗文本</button>
        <button className="stamp border-brass text-brass disabled:opacity-50" disabled={busy || cleanUndo === null} onClick={undoClean}>撤销清洗</button>
        <button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!apiOnline || busy || !text.trim()} onClick={() => void makeDraft()}>分析为资料卡片</button>
        <button className="stamp border-paper/70 text-paper disabled:opacity-50" disabled={!text} onClick={() => void navigator.clipboard?.writeText(text)}>复制文本</button>
        <button className="stamp border-walnut text-walnut" onClick={() => setText('')}>清空文本</button>
      </div>
      <p className="mt-3 text-xs text-walnut/70">中文 OCR 建议使用清晰大字、白底黑字、中文模式。复杂设定图可先裁剪文字区域，识别后请人工校对。</p>
      {preview ? <div className="mt-3 border border-walnut/20 bg-paper/60 p-3 text-xs text-walnut/80">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold text-espresso">资料卡片化预览 · 生成草稿前请确认</p><p>parserMode：{preview.parserMode || 'Clipboard Screenshot + External OCR Text'} · 主证物图：{preview.sourceWillBecomePrimaryEvidence ? 'Approve & File 后设为 primaryEvidenceId' : '否'}</p></div><div className="flex gap-2"><button className={`stamp ${previewMode === 'card' ? 'border-crimson text-crimson' : 'border-brass text-brass'}`} onClick={() => setPreviewMode('card')}>卡片视图</button><button className={`stamp ${previewMode === 'mind' ? 'border-crimson text-crimson' : 'border-brass text-brass'}`} onClick={() => setPreviewMode('mind')}>脑图视图</button></div></div>
        {previewMode === 'card' ? <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="border border-walnut/20 bg-paper p-2"><p className="font-bold text-espresso">当前截图 / 图片证物</p><img src={file.url} alt={file.name} className="mt-2 max-h-72 w-full object-contain sepia" /><p className="mt-2 break-all">来源图片：{file.name}</p></div>
          <div className="grid gap-2 border border-walnut/20 bg-paper p-2"><p className="font-bold text-espresso">外部 OCR 文本</p><label>原始粘贴文本<textarea className="paper-input min-h-28" value={ocr.text || cleanUndo || text} readOnly /></label><label>清洗后文本<textarea className="paper-input min-h-28" value={text} onChange={(e) => setText(e.target.value)} /></label></div>
          <div className="grid gap-2 border border-walnut/20 bg-paper p-2"><p className="font-bold text-espresso">资料卡片预览（可编辑）</p><label>资料类型<select className="paper-input" value={designType} onChange={(e) => setDesignType(e.target.value)}>{types.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>名称<input className="paper-input" value={String(previewAsset.name || '')} onChange={(e) => updatePreviewAsset('name', e.target.value)} /></label><label>英文名<input className="paper-input" value={String(previewAsset.englishName || '')} onChange={(e) => updatePreviewAsset('englishName', e.target.value)} /></label><label>简介<textarea className="paper-input min-h-20" value={String(previewAsset.summary || '')} onChange={(e) => updatePreviewAsset('summary', e.target.value)} /></label><label>详情<textarea className="paper-input min-h-28" value={String(previewAsset.details || '')} onChange={(e) => updatePreviewAsset('details', e.target.value)} /></label><label>标签<input className="paper-input" value={Array.isArray(previewAsset.tags) ? previewAsset.tags.join('，') : String(previewAsset.tags || '')} onChange={(e) => updatePreviewAsset('tags', e.target.value)} /></label><label>关联角色<input className="paper-input" value={Array.isArray(previewAsset.relatedCharacterIds) ? previewAsset.relatedCharacterIds.join('，') : ''} onChange={(e) => updatePreviewAsset('relatedCharacterIds', e.target.value)} /></label><label>关联帮派<input className="paper-input" value={Array.isArray(previewAsset.relatedFactionIds) ? previewAsset.relatedFactionIds.join('，') : ''} onChange={(e) => updatePreviewAsset('relatedFactionIds', e.target.value)} /></label><label>关联区域<input className="paper-input" value={Array.isArray(previewAsset.relatedDistrictIds) ? previewAsset.relatedDistrictIds.join('，') : ''} onChange={(e) => updatePreviewAsset('relatedDistrictIds', e.target.value)} /></label><label>关联地点<input className="paper-input" value={Array.isArray(previewAsset.relatedPoiIds) ? previewAsset.relatedPoiIds.join('，') : ''} onChange={(e) => updatePreviewAsset('relatedPoiIds', e.target.value)} /></label><p>来源图片：{preview.sourceFileName || file.name}</p></div>
        </div> : <div className="mt-3 grid gap-3 md:grid-cols-3"><div className="border-2 border-crimson bg-crimson/10 p-3 text-center font-display text-2xl text-espresso">{String(previewAsset.name || '未命名档案')}</div>{[['基本信息', `${preview.targetType} · ${String(previewAsset.englishName || '')}`], ['简介', String(previewAsset.summary || '待补充')], ['详情', String(previewAsset.details || '待补充').slice(0, 260)], ['关联角色', Array.isArray(previewAsset.relatedCharacterIds) ? previewAsset.relatedCharacterIds.join('，') : '无'], ['关联地点', Array.isArray(previewAsset.relatedPoiIds) ? previewAsset.relatedPoiIds.join('，') : '无'], ['关联势力', Array.isArray(previewAsset.relatedFactionIds) ? previewAsset.relatedFactionIds.join('，') : '无'], ['标签', Array.isArray(previewAsset.tags) ? previewAsset.tags.join('，') : '无'], ['来源', file.name]].map(([title, body]) => <div key={title} className="border border-brass/30 bg-paper p-3"><p className="font-bold text-espresso">{title}</p><p className="mt-1 whitespace-pre-wrap">{body}</p></div>)}</div>}
        {preview.warnings?.length ? <p className="mt-2 text-crimson">提示：{preview.warnings.join(' / ')}</p> : null}
        <details className="mt-2"><summary className="font-bold">字段解析明细</summary><ul className="list-disc pl-5">{preview.recognizedFields.length ? preview.recognizedFields.map((item, index) => <li key={`${item.field}-${index}`}>{item.label} → {item.field}: {item.value}</li>) : <li>暂无明确字段，请返回修改文本。</li>}</ul><p className="mt-2 font-bold">未识别文本 / 已进入详情</p><pre className="whitespace-pre-wrap">{preview.unrecognizedText || '无'}</pre></details>
        <div className="mt-3 flex flex-wrap gap-2"><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={busy || !text.trim()} onClick={() => void confirmDraft()}>确认生成草稿</button><button className="stamp border-brass text-brass disabled:opacity-50" disabled={busy} onClick={() => setPreview(null)}>返回修改文本</button><button className="stamp border-walnut text-walnut disabled:opacity-50" disabled={busy} onClick={() => { setPreview(null); setMessage('已取消草稿生成。'); }}>取消</button></div>
      </div> : null}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { IntakeDraft, OcrDesignType, OcrDraftPreview, OcrResult, UploadedFileRecord } from '../../utils/api';
import { ApiError, archiveErrorMessage, createOcrDraft, getOcrEngineStatus, getOcrResult, listOcrDesignTypes, previewOcrDraft, runOcr, saveOcrText } from '../../utils/api';
import type { ArchiveNotifier } from '../ui/ArchiveNotice';

const languageOptions = [
  { value: 'auto', label: '自动' },
  { value: 'chi_sim', label: '中文' },
  { value: 'eng', label: '英文' },
  { value: 'chi_sim+eng', label: '中英混合' },
];
const fieldLinePattern = /^\s*[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z\s]{0,32}\s*[:：=]/u;
const cleanOcrText = (value: string) => {
  const fixed = value
    .replace(/姓\s+名/g, '姓名')
    .replace(/英\s+文\s+名/g, '英文名')
    .replace(/简\s+介/g, '简介')
    .replace(/职\s+业/g, '职业')
    .replace(/标\s+签/g, '标签');
  const lines = fixed.split(/\r?\n/).map((line) => line.trim()).filter((line, index, all) => line || (index > 0 && all[index - 1].trim()));
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
const fallbackStatusFromError = (message: string) => message.includes('权限') || message.includes('安全策略') || message.includes('拦截') ? 'OCR 被系统拦截，可手动粘贴' : 'OCR 不可用，可手动粘贴';

export function OcrResultEditor({ file, apiOnline, notify, onDraftCreated }: { file: UploadedFileRecord; apiOnline: boolean; notify?: ArchiveNotifier; onDraftCreated?: (draft: IntakeDraft) => void }) {
  const [ocr, setOcr] = useState<OcrResult>({ sourceFileId: file.id, sourceFileName: file.name, status: 'none', text: '' });
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('auto');
  const [preprocess, setPreprocess] = useState('original');
  const [designType, setDesignType] = useState('other_design');
  const [types, setTypes] = useState<OcrDesignType[]>([]);
  const [busy, setBusy] = useState(false);
  const [hasRunAttempt, setHasRunAttempt] = useState(false);
  const runningRef = useRef(false);
  const [message, setMessage] = useState('OCR 结果不会直接入库，请在草稿区确认。');
  const [engineStatus, setEngineStatus] = useState('OCR 不可用，可手动粘贴');
  const [languageStatus, setLanguageStatus] = useState<{ eng?: boolean; chi_sim?: boolean }>({});
  const [cleanUndo, setCleanUndo] = useState<string | null>(null);
  const [preview, setPreview] = useState<OcrDraftPreview | null>(null);

  useEffect(() => {
    if (!apiOnline) return;
    let cancelled = false;
    setHasRunAttempt(false);
    void getOcrResult(file.id).then((result) => { if (!cancelled) { setOcr(result); setText(result.text || ''); setLanguage(result.language || 'auto'); setPreprocess(result.preprocess || 'original'); if (result.engineStatus || result.statusLabel) setEngineStatus(result.engineStatus || result.statusLabel || 'OCR 不可用，可手动粘贴'); } }).catch(() => undefined);
    void getOcrEngineStatus().then((status) => { if (!cancelled) { setEngineStatus(status.statusLabel || status.message || 'OCR 不可用，可手动粘贴'); setLanguageStatus(status.languageStatus || { eng: status.languages.includes('eng'), chi_sim: status.languages.includes('chi_sim') }); if (status.languageWarnings?.length) setMessage(status.languageWarnings.join(' ')); } }).catch(() => { if (!cancelled) setEngineStatus('OCR 不可用，可手动粘贴'); });
    void listOcrDesignTypes().then((items) => { if (!cancelled) setTypes(items); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [apiOnline, file.id]);

  const run = async () => {
    if (runningRef.current) return;
    if (!apiOnline || !isImage(file)) { setMessage('当前文件不是图片，无法 OCR。'); return; }
    runningRef.current = true;
    setHasRunAttempt(true);
    setBusy(true); setMessage('识别中 · 请等待本地 OCR 引擎处理，结果需要人工校对。');
    try {
      const result = await runOcr({ fileId: file.id, language, preprocess });
      setOcr(result); setText(result.text || ''); if (result.engineStatus || result.statusLabel) setEngineStatus(result.engineStatus || result.statusLabel || 'OCR 不可用，可手动粘贴');
      const friendly = result.text ? '识别完成。请先校对识别文本，再生成草稿。' : result.error || '没有识别到文字，请尝试更清晰的图片，或手动粘贴文本。';
      setMessage(friendly);
      notify?.({ tone: result.status === 'done' ? 'success' : 'info', title: result.status === 'done' ? 'OCR 识别完成' : friendly, detail: result.status === 'done' ? file.name : undefined });
    } catch (error) {
      const friendly = archiveErrorMessage(error, 'OCR 请求失败，请检查本地服务。');
      const engineLabel = fallbackStatusFromError(friendly);
      const body = error instanceof ApiError && typeof error.body === 'object' && error.body ? error.body as { engine?: string; status?: string; error?: string } : undefined;
      setEngineStatus(engineLabel);
      setOcr((current) => ({ ...current, status: body?.status === 'failed' ? 'failed' : current.status, engine: body?.engine || 'manual-fallback', engineStatus: engineLabel, statusLabel: engineLabel, error: friendly }));
      setMessage(friendly);
      notify?.({ tone: 'error', title: friendly });
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
      const result = await createOcrDraft({ fileId: file.id, text, designType });
      setPreview({ ...preview, ...result });
      onDraftCreated?.(result.draft);
      setMessage('草稿已写入 Parsed Drafts，请到解析草稿区确认。');
      notify?.({ tone: 'success', title: '草稿已写入 Parsed Drafts。', detail: `${result.draft.asset.name} · ${result.targetType}` });
    } catch (error) { const friendly = archiveErrorMessage(error, '生成草稿失败。'); setMessage(friendly); notify?.({ tone: 'error', title: friendly }); }
    finally { setBusy(false); }
  };

  return (
    <section className="border border-brass/30 bg-espresso/10 p-3 text-espresso">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="type-label text-crimson">图片文字识别 / OCR</p><h3 className="font-display text-xl">证物文字提取台</h3><p className="text-xs text-walnut/70">识别结果需要人工校对；OCR 结果不会直接入库。</p></div>
        <span className="stamp border-brass text-brass">{statusLabel[ocr.status] || ocr.status}</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[120px_1fr]">
        <img src={file.url} alt={file.name} className="h-28 w-28 border-4 border-paper object-cover shadow-noir" />
        <div className="grid gap-2 text-xs text-walnut/75"><span>文件名：{file.name}</span><span>OCR 语言：{ocr.language || language}</span><span>置信度：{ocr.confidence ? `${(ocr.confidence * 100).toFixed(1)}%` : '暂无'}</span><span>当前引擎：{(ocr.engine || '').includes('tesseract') || engineStatus.includes('项目内') ? '项目内 OCR' : '可选本地引擎 / 手动粘贴'}</span><span>引擎状态：{ocr.engineStatus || ocr.statusLabel || engineStatus}</span><span>英文识别：{languageStatus.eng ? '可用' : '不可用'}</span><span>简体中文识别：{languageStatus.chi_sim ? '可用' : '不可用'}</span>{ocr.error ? <span className="text-crimson">{ocr.error}</span> : null}</div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <label><span className="field-label">识别语言</span><select className="paper-input" value={language} onChange={(e) => setLanguage(e.target.value)}>{languageOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="field-label">图片预处理</span><select className="paper-input" value={preprocess} onChange={(e) => setPreprocess(e.target.value)}><option value="original">使用原图</option><option value="contrast">提高对比度（预留）</option><option value="grayscale">灰度识别（预留）</option></select></label>
        <label><span className="field-label">资料类型</span><select className="paper-input" value={designType} onChange={(e) => setDesignType(e.target.value)}>{types.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>
      <label className="mt-3 block"><span className="field-label">识别文本 · 手动粘贴识别文本</span><textarea className="paper-input min-h-44" value={text} onChange={(e) => setText(e.target.value)} placeholder="本地 OCR 引擎不可用时，请手动粘贴识别文本。" /></label>
      <p className="mt-2 border border-brass/20 bg-brass/10 p-2 text-xs text-walnut/75">请先校对识别文本，再生成草稿。{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="stamp border-brass text-brass disabled:opacity-50" disabled={!apiOnline || busy} onClick={() => void run()}>{ocr.text || hasRunAttempt ? '重新识别' : '识别文字'}</button>
        <button className="stamp border-brass text-brass disabled:opacity-50" disabled={!apiOnline || busy} onClick={() => void save()}>保存文本</button>
        <button className="stamp border-brass text-brass disabled:opacity-50" disabled={busy || !text.trim()} onClick={cleanText}>清洗文本</button>
        <button className="stamp border-brass text-brass disabled:opacity-50" disabled={busy || cleanUndo === null} onClick={undoClean}>撤销清洗</button>
        <button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!apiOnline || busy || !text.trim()} onClick={() => void makeDraft()}>用文本生成草稿</button>
        <button className="stamp border-paper/70 text-paper disabled:opacity-50" disabled={!text} onClick={() => void navigator.clipboard?.writeText(text)}>复制文本</button>
        <button className="stamp border-walnut text-walnut" onClick={() => setText('')}>清空文本</button>
      </div>
      {preview ? <div className="mt-3 border border-walnut/20 bg-paper/60 p-3 text-xs text-walnut/80">
        <p className="font-bold text-espresso">草稿解析预览 · 尚未写入 Parsed Drafts</p>
        <div className="mt-2 grid gap-1 md:grid-cols-2">
          <span>目标资料类型：{preview.targetType}</span>
          <span>目标数据文件：data/{preview.targetFile}</span>
          <span>主证物图：{preview.sourceWillBecomePrimaryEvidence ? 'Approve & File 后设为 primaryEvidenceId' : '否'}</span>
          <span>草稿名称：{String(preview.asset?.name || '未命名 OCR 草稿')}</span>
          <span>sourceFileName：{preview.sourceFileName || file.name}</span>
          <span>parserMode：{preview.parserMode || 'Image OCR'}</span>
        </div>
        {preview.warnings?.length ? <p className="mt-2 text-crimson">提示：{preview.warnings.join(' / ')}</p> : null}
        <p className="mt-2 font-bold">已识别字段</p>
        <ul className="list-disc pl-5">{preview.recognizedFields.length ? preview.recognizedFields.map((item, index) => <li key={`${item.field}-${index}`}>{item.label} → {item.field}: {item.value}</li>) : <li>暂无明确字段，请返回修改文本。</li>}</ul>
        <p className="mt-2 font-bold">未识别文本 / 需人工确认</p><pre className="whitespace-pre-wrap">{preview.unrecognizedText || '无'}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={busy} onClick={() => void confirmDraft()}>确认生成草稿</button>
          <button className="stamp border-brass text-brass disabled:opacity-50" disabled={busy} onClick={() => setPreview(null)}>返回修改文本</button>
          <button className="stamp border-walnut text-walnut disabled:opacity-50" disabled={busy} onClick={() => { setPreview(null); setMessage('已取消草稿生成。'); }}>取消</button>
        </div>
      </div> : null}
    </section>
  );
}

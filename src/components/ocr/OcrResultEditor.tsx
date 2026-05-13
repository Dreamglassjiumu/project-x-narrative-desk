import { useEffect, useState } from 'react';
import type { IntakeDraft, OcrDesignType, OcrResult, UploadedFileRecord } from '../../utils/api';
import { archiveErrorMessage, createOcrDraft, getOcrResult, listOcrDesignTypes, runOcr, saveOcrText } from '../../utils/api';
import type { ArchiveNotifier } from '../ui/ArchiveNotice';

const languageOptions = [
  { value: 'chi_sim+eng', label: '中英混合' },
  { value: 'auto', label: '自动' },
  { value: 'chi_sim', label: '中文' },
  { value: 'eng', label: '英文' },
];
const statusLabel: Record<string, string> = { none: '未识别', queued: '排队中', processing: '识别中', done: '识别完成', failed: '识别失败', manual: '手动文本' };
const isImage = (file: UploadedFileRecord) => file.folder === 'images' || file.type?.startsWith('image/');

export function OcrResultEditor({ file, apiOnline, notify, onDraftCreated }: { file: UploadedFileRecord; apiOnline: boolean; notify?: ArchiveNotifier; onDraftCreated?: (draft: IntakeDraft) => void }) {
  const [ocr, setOcr] = useState<OcrResult>({ sourceFileId: file.id, sourceFileName: file.name, status: 'none', text: '' });
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('chi_sim+eng');
  const [designType, setDesignType] = useState('other_design');
  const [types, setTypes] = useState<OcrDesignType[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('OCR 结果不会直接入库，请在草稿区确认。');
  const [preview, setPreview] = useState<{ recognizedFields: Array<{ field: string; label: string; value: string }>; unrecognizedText: string; warnings: string[] } | null>(null);

  useEffect(() => {
    if (!apiOnline) return;
    let cancelled = false;
    void getOcrResult(file.id).then((result) => { if (!cancelled) { setOcr(result); setText(result.text || ''); setLanguage(result.language || 'chi_sim+eng'); } }).catch(() => undefined);
    void listOcrDesignTypes().then((items) => { if (!cancelled) setTypes(items); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [apiOnline, file.id]);

  const run = async () => {
    if (!apiOnline || !isImage(file)) { setMessage('当前文件不是图片，无法 OCR。'); return; }
    setBusy(true); setMessage('识别中 · 请等待本地 OCR 引擎处理，结果需要人工校对。');
    try {
      const result = await runOcr({ fileId: file.id, language });
      setOcr(result); setText(result.text || ''); setMessage(result.text ? '识别完成。请先校对识别文本，再生成草稿。' : result.error || '没有识别到文字。');
      notify?.({ tone: 'success', title: 'OCR 识别完成', detail: file.name });
    } catch (error) {
      const friendly = archiveErrorMessage(error, '本地 OCR 引擎不可用，请手动粘贴识别文本。');
      setOcr((current) => ({ ...current, status: 'failed', error: friendly })); setMessage(friendly); notify?.({ tone: 'info', title: friendly });
    } finally { setBusy(false); }
  };
  const save = async () => {
    if (!apiOnline) return;
    setBusy(true);
    try { const result = await saveOcrText(file.id, { text, language, status: text.trim() ? 'manual' : 'none' }); setOcr(result); setMessage('识别文本已保存。请继续选择资料类型并生成草稿。'); notify?.({ tone: 'success', title: '识别文本已保存。' }); }
    catch (error) { const friendly = archiveErrorMessage(error, '保存识别文本失败。'); setMessage(friendly); notify?.({ tone: 'error', title: friendly }); }
    finally { setBusy(false); }
  };
  const makeDraft = async () => {
    if (!text.trim()) { setMessage('请先保存识别文本。'); return; }
    if (!designType) { setMessage('请选择资料类型。'); return; }
    setBusy(true);
    try {
      const saved = await saveOcrText(file.id, { text, language, status: 'manual' });
      setOcr(saved);
      const result = await createOcrDraft({ fileId: file.id, text, designType });
      setPreview({ recognizedFields: result.recognizedFields, unrecognizedText: result.unrecognizedText, warnings: result.warnings });
      onDraftCreated?.(result.draft);
      setMessage('已生成 Parsed Draft。OCR 结果不会直接入库，请在草稿区确认。');
      notify?.({ tone: 'success', title: 'OCR 文本已生成待确认草稿', detail: `${result.draft.asset.name} · ${result.targetType}` });
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
        <div className="grid gap-2 text-xs text-walnut/75"><span>文件名：{file.name}</span><span>OCR 语言：{ocr.language || language}</span><span>置信度：{ocr.confidence ? `${ocr.confidence.toFixed(1)}%` : '暂无'}</span><span>引擎：{ocr.engine || '可选本地引擎 / 手动粘贴'}</span>{ocr.error ? <span className="text-crimson">{ocr.error}</span> : null}</div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <label><span className="field-label">识别语言</span><select className="paper-input" value={language} onChange={(e) => setLanguage(e.target.value)}>{languageOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="field-label">图片预处理</span><select className="paper-input" defaultValue="original"><option value="original">使用原图</option><option value="contrast">提高对比度（预留）</option></select></label>
        <label><span className="field-label">资料类型</span><select className="paper-input" value={designType} onChange={(e) => setDesignType(e.target.value)}>{types.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>
      <label className="mt-3 block"><span className="field-label">识别文本 · 手动粘贴识别文本</span><textarea className="paper-input min-h-44" value={text} onChange={(e) => setText(e.target.value)} placeholder="本地 OCR 引擎不可用时，请手动粘贴识别文本。" /></label>
      <p className="mt-2 border border-brass/20 bg-brass/10 p-2 text-xs text-walnut/75">请先校对识别文本，再生成草稿。{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="stamp border-brass text-brass disabled:opacity-50" disabled={!apiOnline || busy} onClick={() => void run()}>{ocr.text ? '重新识别' : '识别文字'}</button>
        <button className="stamp border-brass text-brass disabled:opacity-50" disabled={!apiOnline || busy} onClick={() => void save()}>保存文本</button>
        <button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!apiOnline || busy} onClick={() => void makeDraft()}>用文本生成草稿</button>
        <button className="stamp border-paper/70 text-paper disabled:opacity-50" disabled={!text} onClick={() => void navigator.clipboard?.writeText(text)}>复制文本</button>
        <button className="stamp border-walnut text-walnut" onClick={() => setText('')}>清空文本</button>
      </div>
      {preview ? <details className="mt-3 border border-walnut/20 bg-paper/60 p-2 text-xs text-walnut/80" open><summary>草稿解析预览</summary><p className="mt-2 font-bold">已识别字段</p><ul className="list-disc pl-5">{preview.recognizedFields.map((item, index) => <li key={`${item.field}-${index}`}>{item.label} → {item.field}: {item.value}</li>)}</ul><p className="mt-2 font-bold">未识别文本 / 需人工确认</p><pre className="whitespace-pre-wrap">{preview.unrecognizedText || '无'}</pre></details> : null}
    </section>
  );
}

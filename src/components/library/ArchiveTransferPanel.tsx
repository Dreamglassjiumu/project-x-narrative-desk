import { useRef, useState } from 'react';
import type { ArchiveExport, AssetBundle } from '../../utils/api';
import { archiveErrorMessage, exportArchive, importArchive } from '../../utils/api';
import type { ArchiveNotifier } from '../ui/ArchiveNotice';
import { ConfirmDialog } from '../forms/ConfirmDialog';

const keys = ['factions', 'districts', 'pois', 'characters', 'storylines', 'pitches'] as const;

export function ArchiveTransferPanel({ onImported, notify }: { onImported: (bundle: AssetBundle) => void; notify: ArchiveNotifier }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ArchiveExport | null>(null);
  const [mode, set导入方式] = useState<'merge' | 'replace'>('merge');
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const download = async () => {
    try {
    const data = await exportArchive();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'project-x-narrative-desk-export.json'; link.click(); URL.revokeObjectURL(url);
    notify({ tone: 'success', title: '档案资料包已导出。' });
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '写入失败。') }); }
  };
  const load = async (file?: File) => {
    if (!file) return;
    const parsed = JSON.parse(await file.text()) as ArchiveExport;
    setPreview(parsed); setMessage(`导入清单已读取 · ${parsed.version ?? 'unknown'} · ${parsed.exportedAt ?? 'no date'}`);
  };
  const execute = async () => { if (!preview) return; try { const bundle = await importArchive(preview, mode); onImported(bundle); setConfirm(false); setMessage('资料包导入完成，本地 JSON 已更新。'); notify({ tone: 'success', title: '资料包导入完成，本地 JSON 已更新。' }); } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '写入失败。') }); } };

  return (
    <section className="dossier-panel p-5">
      <p className="type-label text-crimson">DATA BACKUP / ARCHIVE TRANSFER</p>
      <h3 className="font-display text-2xl text-espresso">资料包导入导出</h3>
      <div className="mt-4 flex flex-wrap gap-3"><button className="evidence-button" onClick={() => void download()}>导出 JSON 包</button><button className="stamp border-brass text-brass" onClick={() => inputRef.current?.click()}>预览导入</button><input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void load(event.target.files?.[0])} /></div>
      {preview ? <div className="mt-4 border border-walnut/20 bg-espresso/5 p-3"><p className="type-label text-walnut/60">导入预览</p><div className="mt-2 grid grid-cols-2 gap-2 text-sm text-espresso/80">{keys.map((key) => <span key={key}>{key}: {(preview[key] ?? []).length}</span>)}</div><label className="mt-3 block"><span className="field-label">导入方式</span><select className="paper-input" value={mode} onChange={(e) => set导入方式(e.target.value as 'merge' | 'replace')}><option value="merge">按 ID 合并</option><option value="replace">全部替换</option></select></label><button className="mt-3 evidence-button" onClick={() => setConfirm(true)}>执行导入</button></div> : null}
      {message ? <p className="mt-3 font-mono text-xs text-walnut/70">{message}</p> : null}
      <ConfirmDialog open={confirm} title="导入资料包？" message={`将${mode === 'replace' ? '全部替换本地 JSON' : '按 ID 合并到本地 JSON'}。`} confirmLabel="导入" onCancel={() => setConfirm(false)} onConfirm={() => void execute()} />
    </section>
  );
}

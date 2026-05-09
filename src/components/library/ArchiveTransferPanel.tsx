import { useRef, useState } from 'react';
import type { ArchiveExport, AssetBundle } from '../../utils/api';
import { archiveErrorMessage, exportArchive, importArchive } from '../../utils/api';
import type { ArchiveNotifier } from '../ui/ArchiveNotice';
import { ConfirmDialog } from '../forms/ConfirmDialog';

const keys = ['factions', 'districts', 'pois', 'characters', 'storylines', 'pitches'] as const;

export function ArchiveTransferPanel({ onImported, notify }: { onImported: (bundle: AssetBundle) => void; notify: ArchiveNotifier }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ArchiveExport | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const download = async () => {
    try {
    const data = await exportArchive();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'project-x-narrative-desk-export.json'; link.click(); URL.revokeObjectURL(url);
    notify({ tone: 'success', title: 'Archive package exported.' });
    } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, 'Write failed') }); }
  };
  const load = async (file?: File) => {
    if (!file) return;
    const parsed = JSON.parse(await file.text()) as ArchiveExport;
    setPreview(parsed); setMessage(`Transfer manifest loaded · ${parsed.version ?? 'unknown'} · ${parsed.exportedAt ?? 'no date'}`);
  };
  const execute = async () => { if (!preview) return; try { const bundle = await importArchive(preview, mode); onImported(bundle); setConfirm(false); setMessage('Archive transfer complete. Local JSON files updated.'); notify({ tone: 'success', title: 'Archive transfer complete. Local JSON files updated.' }); } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, 'Write failed') }); } };

  return (
    <section className="dossier-panel p-5">
      <p className="type-label text-crimson">DATA BACKUP / ARCHIVE TRANSFER</p>
      <h3 className="font-display text-2xl text-espresso">资料包导入 / 导出</h3>
      <div className="mt-4 flex flex-wrap gap-3"><button className="evidence-button" onClick={() => void download()}>Export JSON Package</button><button className="stamp border-brass text-brass" onClick={() => inputRef.current?.click()}>Preview Import</button><input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void load(event.target.files?.[0])} /></div>
      {preview ? <div className="mt-4 border border-walnut/20 bg-espresso/5 p-3"><p className="type-label text-walnut/60">IMPORT PREVIEW</p><div className="mt-2 grid grid-cols-2 gap-2 text-sm text-espresso/80">{keys.map((key) => <span key={key}>{key}: {(preview[key] ?? []).length}</span>)}</div><label className="mt-3 block"><span className="field-label">Mode</span><select className="paper-input" value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')}><option value="merge">merge by id</option><option value="replace">replace all</option></select></label><button className="mt-3 evidence-button" onClick={() => setConfirm(true)}>Execute Import</button></div> : null}
      {message ? <p className="mt-3 font-mono text-xs text-walnut/70">{message}</p> : null}
      <ConfirmDialog open={confirm} title="Import Archive Package?" message={`This will ${mode === 'replace' ? 'replace all local data JSON files' : 'merge records by id into local JSON files'}.`} confirmLabel="IMPORT" onCancel={() => setConfirm(false)} onConfirm={() => void execute()} />
    </section>
  );
}

import { useRef, useState } from 'react';
import type { AssetBundle, UploadedFileRecord } from '../../utils/api';
import { deleteUpload, updateUpload, uploadFiles } from '../../utils/api';
import { flattenAssets } from '../../utils/api';
import { ConfirmDialog } from '../forms/ConfirmDialog';
import { FileBindDialog } from './FileBindDialog';
import { ArchiveTransferPanel } from './ArchiveTransferPanel';

const formatSize = (size: number) => size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;

export function LocalLibraryPage({ bundle, files, apiOnline, onFilesChanged, onAssetsImported }: { bundle: AssetBundle; files: UploadedFileRecord[]; apiOnline: boolean; onFilesChanged: (files: UploadedFileRecord[]) => void; onAssetsImported: (bundle: AssetBundle) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingTags, setPendingTags] = useState('');
  const [pendingLinks, setPendingLinks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [binding, setBinding] = useState<UploadedFileRecord | undefined>();
  const [deleting, setDeleting] = useState<UploadedFileRecord | undefined>();
  const assets = flattenAssets(bundle);

  const onFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setBusy(true);
    try {
      const uploaded = await uploadFiles(fileList, { tags: pendingTags.split(',').map((x) => x.trim()).filter(Boolean), linkedAssetIds: pendingLinks });
      onFilesChanged([...uploaded, ...files]); setPendingLinks([]); setPendingTags(''); if (inputRef.current) inputRef.current.value = ''; setError(null);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : '上传失败'); } finally { setBusy(false); }
  };
  const saveBinding = async (metadata: { tags: string[]; linkedAssetIds: string[] }) => { if (!binding) return; const saved = await updateUpload(binding.id, metadata); onFilesChanged(files.map((file) => file.id === saved.id ? saved : file)); setBinding(undefined); };
  const confirmDelete = async () => { if (!deleting) return; await deleteUpload(deleting.id); onFilesChanged(files.filter((file) => file.id !== deleting.id)); setDeleting(undefined); };

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
      <div className="space-y-5">
        <div className="border-2 border-dashed border-brass/40 bg-walnut/45 p-8 text-center shadow-dossier">
          <p className="type-label text-crimson">EVIDENCE LOCKER / 本地证物柜</p><h2 className="mt-2 font-display text-3xl text-ivory">Upload Local Files</h2>
          {!apiOnline ? <p className="mt-3 border border-crimson/40 bg-burgundy/45 p-2 font-mono text-xs text-paper">Local API offline. Archive is read-only.</p> : null}
          <input className="paper-input mt-5" value={pendingTags} onChange={(e) => setPendingTags(e.target.value)} placeholder="tags: mugshot, concept, ledger" />
          <select multiple className="paper-input mt-3 min-h-40" value={pendingLinks} onChange={(e) => setPendingLinks(Array.from(e.currentTarget.selectedOptions).map((o) => o.value))}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.category} · {asset.name}</option>)}</select>
          <label className={`mt-6 inline-flex cursor-pointer evidence-button ${busy || !apiOnline ? 'opacity-60' : ''}`}>{busy ? '处理中...' : '选择证物文件'}<input ref={inputRef} type="file" multiple accept="image/*,.md,.markdown,.json,.txt,.pdf,.doc,.docx,.xls,.xlsx,.csv" className="hidden" disabled={busy || !apiOnline} onChange={(event) => void onFiles(event.target.files)} /></label>
          {error ? <p className="mt-4 border border-crimson/50 bg-burgundy/45 p-3 font-mono text-xs text-paper">LOCAL API ERROR · {error}</p> : null}
        </div>
        {apiOnline ? <ArchiveTransferPanel onImported={onAssetsImported} /> : null}
      </div>
      <div className="dossier-panel p-5"><div className="mb-4 border-b border-brass/30 pb-3"><p className="type-label text-crimson">LOCKER INDEX</p><h3 className="font-display text-2xl text-espresso">文件列表</h3></div><div className="space-y-3">{files.length === 0 ? <p className="border border-dashed border-walnut/20 bg-espresso/5 p-4 text-sm text-walnut/60">证物柜为空。</p> : null}{files.map((file) => <div key={file.id} className="border border-walnut/20 bg-espresso/5 p-3"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><a href={file.url} target="_blank" rel="noreferrer" className="font-mono text-sm text-espresso underline decoration-walnut/30 underline-offset-4">{file.name}</a><p className="text-xs text-walnut/60">{file.type || 'unknown'} · {file.folder ?? 'uploads'} · {formatSize(file.size)} · {new Date(file.addedAt).toLocaleString()}</p><div className="mt-2 flex flex-wrap gap-1">{file.tags?.map((tag) => <span key={tag} className="tag-label">{tag}</span>)}</div><p className="mt-2 text-xs text-walnut/70">Bound: {file.linkedAssetIds?.map((id) => assets.find((asset) => asset.id === id)?.name ?? id).join(', ') || 'none'}</p></div><div className="flex flex-col gap-2"><button onClick={() => setBinding(file)} disabled={busy || !apiOnline} className="stamp border-brass text-brass disabled:opacity-50">EDIT BIND</button><button onClick={() => setDeleting(file)} disabled={busy || !apiOnline} className="stamp border-crimson text-crimson disabled:opacity-50">DELETE</button></div></div></div>)}</div></div>
      <FileBindDialog file={binding} bundle={bundle} onClose={() => setBinding(undefined)} onSave={(metadata) => void saveBinding(metadata)} />
      <ConfirmDialog open={Boolean(deleting)} title="Destroy Evidence?" message={`This evidence is linked to ${deleting?.linkedAssetIds?.length ?? 0} dossiers.`} confirmLabel="DELETE EVIDENCE" onCancel={() => setDeleting(undefined)} onConfirm={() => void confirmDelete()} />
    </section>
  );
}

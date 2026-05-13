import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnyAsset } from '../../data';
import type { AssetBundle, UploadedFileRecord } from '../../utils/api';
import { archiveErrorMessage, cleanIntakeDrafts, deleteUpload, flattenAssets, listImportHistory, listUploads, updateUpload, uploadFiles, type ImportHistoryRecord } from '../../utils/api';
import type { AssetType } from '../../utils/assetHelpers';
import type { ArchiveNotifier } from '../ui/ArchiveNotice';
import { ConfirmDialog } from '../forms/ConfirmDialog';
import { TagChipInput } from '../forms/TagChipInput';
import { FileBindDialog } from './FileBindDialog';
import { ArchiveTransferPanel } from './ArchiveTransferPanel';
import { BulkEvidenceActions } from './BulkEvidenceActions';
import { EvidenceCreateDossierDialog } from './EvidenceCreateDossierDialog';
import { EvidenceUsageBadge, fileUsageOptions } from './EvidenceUsageBadge';
import { EvidenceLightbox } from '../evidence/EvidenceLightbox';
import { fileUsageLabel, zh } from '../../i18n/zhCN';

const formatSize = (size: number) => size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;
const evidenceFolder = (file: UploadedFileRecord) => `uploads/${file.folder ?? 'documents'}`;
const categoryLabel = (file: UploadedFileRecord) => file.folder === 'images' ? zh.evidence.image : zh.evidence.document;

export function LocalLibraryPage({ bundle, files, apiOnline, onFilesChanged, onAssetsChanged, onAssetsImported, notify }: { bundle: AssetBundle; files: UploadedFileRecord[]; apiOnline: boolean; onFilesChanged: (files: UploadedFileRecord[]) => void; onAssetsChanged: (bundle: AssetBundle) => void; onAssetsImported: (bundle: AssetBundle) => void; notify: ArchiveNotifier }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [pendingLinks, setPendingLinks] = useState<string[]>([]);
  const [pendingUsage, setPendingUsage] = useState('other');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUploaded, setLastUploaded] = useState<UploadedFileRecord[]>([]);
  const [binding, setBinding] = useState<UploadedFileRecord | undefined>();
  const [creatingFrom, setCreatingFrom] = useState<UploadedFileRecord | undefined>();
  const [deleting, setDeleting] = useState<UploadedFileRecord | undefined>();
  const [selected, setSelected] = useState<string[]>([]);
  const [usageFilter, setUsageFilter] = useState('');
  const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [lightboxFile, setLightboxFile] = useState<UploadedFileRecord | null>(null);
  const [history, setHistory] = useState<ImportHistoryRecord[]>([]);
  useEffect(() => { if (apiOnline) void listImportHistory().then(setHistory).catch(() => undefined); }, [apiOnline]);
  const assets = flattenAssets(bundle);
  const visibleFiles = useMemo(() => files.filter((file) => (!usageFilter || (file.fileUsage || 'other') === usageFilter) && (linkFilter === 'all' || (linkFilter === 'linked' ? (file.linkedAssetIds?.length ?? 0) > 0 : (file.linkedAssetIds?.length ?? 0) === 0))), [files, usageFilter, linkFilter]);
  const linkedNames = (file: UploadedFileRecord) => file.linkedAssetIds?.map((id) => assets.find((asset) => asset.id === id)?.name ?? id) ?? [];
  const primaryNames = (file: UploadedFileRecord) => assets.filter((asset) => asset.primaryEvidenceId === file.id || asset.primaryEvidenceId === file.filename).map((asset) => asset.name);
  const importRecords = (file: UploadedFileRecord) => history.filter((item) => item.sourceFileId === file.id || item.sourceFileId === file.filename || item.sourceFileName === file.name || item.sourceFileName?.includes(file.name));
  const cleanFileTestDrafts = async (file: UploadedFileRecord) => { try { const result = await cleanIntakeDrafts({ mode: file.name.toLowerCase().includes('projectx_test') ? 'projectx_test' : 'source', sourceFileName: file.name, withBackup: true }); notify({ tone: 'success', title: '该文件草稿清理完成', detail: `清理 ${result.removed} 条草稿；uploads 原始文件保留。` }); } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '草稿清理失败。') }); } };
  const toggleSelected = (id: string, checked: boolean) => setSelected((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));

  const onFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setBusy(true);
    try {
      const uploaded = await uploadFiles(fileList, { tags: pendingTags, linkedAssetIds: pendingLinks, fileUsage: pendingUsage });
      onFilesChanged([...uploaded, ...files]);
      setLastUploaded(uploaded); setPendingLinks([]); setPendingTags([]); setPendingUsage('other');
      if (inputRef.current) inputRef.current.value = '';
      setError(null);
      notify({ tone: 'success', title: '证物已保存到本地上传文件夹。', detail: uploaded.map((file) => `${file.name} · ${file.type || zh.unknown} · ${formatSize(file.size)} · ${evidenceFolder(file)}`).join('\n') });
    } catch (nextError) { const message = archiveErrorMessage(nextError, '上传失败。'); setError(message); notify({ tone: 'error', title: message }); }
    finally { setBusy(false); }
  };

  const saveBinding = async (metadata: { tags: string[]; linkedAssetIds: string[]; fileUsage?: string }) => {
    if (!binding) return;
    try { const saved = await updateUpload(binding.id, { ...metadata, fileUsage: metadata.fileUsage || binding.fileUsage || 'other' }); onFilesChanged(files.map((file) => file.id === saved.id ? saved : file)); setBinding(undefined); notify({ tone: 'success', title: '证物信息已更新。' }); }
    catch (nextError) { notify({ tone: 'error', title: archiveErrorMessage(nextError, '写入失败。') }); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try { await deleteUpload(deleting.id); onFilesChanged(await listUploads()); setDeleting(undefined); notify({ tone: 'success', title: '证物已从本地上传文件夹移除。' }); }
    catch (nextError) { notify({ tone: 'error', title: archiveErrorMessage(nextError, '写入失败。') }); }
  };
  const onCreated = (recordType: AssetType, asset: AnyAsset, file: UploadedFileRecord) => {
    onAssetsChanged({ ...bundle, [recordType]: [asset, ...(bundle[recordType] as AnyAsset[])] });
    onFilesChanged(files.map((item) => item.id === file.id ? file : item));
    notify({ tone: 'success', title: '已从本地证物建档。', detail: `${asset.name} 已绑定到 ${file.name}` });
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
      <div className="space-y-5">
        <div className="border-2 border-dashed border-brass/40 bg-walnut/45 p-8 text-center shadow-dossier">
          <p className="type-label text-crimson">EVIDENCE LOCKER / 本地证物柜</p><h2 className="mt-2 font-display text-3xl text-ivory">上传本地文件</h2>
          {!apiOnline ? <p className="mt-3 border border-crimson/40 bg-burgundy/45 p-2 font-mono text-xs text-paper">本地接口离线，当前为只读模式。</p> : null}
          <div className="mt-5 text-left"><TagChipInput label="上传标签" value={pendingTags} onChange={setPendingTags} placeholder="mugshot, concept, ledger" /></div>
          <select className="paper-input mt-3" value={pendingUsage} disabled={!apiOnline || busy} onChange={(e) => setPendingUsage(e.target.value)}>{fileUsageOptions.map((item) => <option key={item} value={item}>{fileUsageLabel(item)}</option>)}</select>
          <select multiple className="paper-input mt-3 min-h-40" value={pendingLinks} disabled={!apiOnline || busy} title={!apiOnline ? zh.disabledReadOnly : undefined} onChange={(e) => setPendingLinks(Array.from(e.currentTarget.selectedOptions).map((o) => o.value))}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.category} · {asset.name}</option>)}</select>
          <label className={`mt-6 inline-flex evidence-button ${busy || !apiOnline ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`} title={!apiOnline ? zh.disabledReadOnly : undefined}>{busy ? '正在保存证物…' : '选择证物文件'}<input ref={inputRef} type="file" multiple accept="image/*,.md,.markdown,.json,.txt,.pdf,.doc,.docx,.xls,.xlsx,.csv" className="hidden" disabled={busy || !apiOnline} onChange={(event) => void onFiles(event.target.files)} /></label>
          {lastUploaded.length ? <div className="mt-5 border border-teal/50 bg-police/40 p-3 text-left font-mono text-xs text-paper"><p className="type-label text-brass">最近保存的证物</p>{lastUploaded.map((file) => <p key={file.id} className="mt-2">{file.name} · {file.type || zh.unknown} · {formatSize(file.size)} · {evidenceFolder(file)}</p>)}</div> : null}
          {error ? <p className="mt-4 border border-crimson/50 bg-burgundy/45 p-3 font-mono text-xs text-paper">本地接口错误 · {error}</p> : null}
        </div>
        {apiOnline ? <ArchiveTransferPanel onImported={onAssetsImported} notify={notify} /> : null}
      </div>
      <div className="dossier-panel p-5">
        <div className="mb-4 border-b border-brass/30 pb-3"><p className="type-label text-crimson">LOCKER INDEX</p><h3 className="font-display text-2xl text-espresso">文件列表</h3></div>
        <div className="mb-4 grid gap-3 md:grid-cols-3"><select className="paper-input" value={usageFilter} onChange={(e) => setUsageFilter(e.target.value)}><option value="">全部</option>{fileUsageOptions.map((item) => <option key={item} value={item}>{fileUsageLabel(item)}</option>)}</select><select className="paper-input" value={linkFilter} onChange={(e) => setLinkFilter(e.target.value as 'all' | 'linked' | 'unlinked')}><option value="all">全部</option><option value="linked">已绑定</option><option value="unlinked">未绑定</option></select><button className="stamp border-brass text-brass" onClick={() => setSelected(selected.length === visibleFiles.length ? [] : visibleFiles.map((file) => file.id))}>{selected.length === visibleFiles.length ? zh.buttons.selectNone : zh.buttons.selectVisible}</button></div>
        <BulkEvidenceActions selected={selected} files={files} disabled={!apiOnline} onSaved={(next) => { onFilesChanged(next); notify({ tone: 'success', title: '批量证物信息已更新。' }); }} />
        <div className="space-y-3">
          {visibleFiles.length === 0 ? <p className="border border-dashed border-walnut/20 bg-espresso/5 p-4 text-sm text-walnut/60">证物柜为空。</p> : null}
          {visibleFiles.map((file) => {
            const names = linkedNames(file); const unlinked = !names.length; const imports = importRecords(file);
            return (
              <div key={file.id} className={`border ${unlinked ? 'border-crimson/40' : 'border-walnut/20'} bg-espresso/5 p-3`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <label className="mb-2 flex items-center gap-2 font-mono text-xs text-walnut/70"><input type="checkbox" checked={selected.includes(file.id)} onChange={(e) => toggleSelected(file.id, e.target.checked)} /> 选择证物</label>
                    <p className="type-label text-crimson">{categoryLabel(file)}</p>
                    {unlinked ? <p className="mt-1 inline-block border border-crimson/50 bg-crimson/10 px-2 py-1 font-mono text-xs uppercase tracking-[0.18em] text-crimson">未归档证物</p> : null}
                    {file.folder === 'images' ? <button onClick={() => setLightboxFile(file)} className="block truncate font-mono text-sm text-espresso underline decoration-walnut/30 underline-offset-4">{file.name}</button> : <a href={file.url} target="_blank" rel="noreferrer" className="block truncate font-mono text-sm text-espresso underline decoration-walnut/30 underline-offset-4">{file.name}</a>}
                    <p className="text-xs text-walnut/60">{file.type || zh.unknown} · {evidenceFolder(file)} · {formatSize(file.size)}</p>
                    <p className="text-xs text-walnut/60">上传时间： {new Date(file.addedAt).toLocaleString()}</p>
                    <div className="mt-2 flex flex-wrap gap-1"><EvidenceUsageBadge usage={file.fileUsage} />{file.tags?.length ? file.tags.map((tag) => <span key={tag} className="tag-label">{tag}</span>) : <span className="tag-label opacity-60">无标签</span>}</div>
                    <p className="mt-2 text-xs text-walnut/70">已绑定档案： {names.join(', ') || zh.none}</p><p className="text-xs text-walnut/70">主图用于： {primaryNames(file).join(', ') || zh.none}</p><div className="mt-2 border border-walnut/15 bg-paper/60 p-2 text-xs text-walnut/70"><p>此文件已导入过 {imports.reduce((sum, item) => sum + (item.filedCount || 0), 0)} 条档案</p>{imports.slice(0, 3).flatMap((item) => item.filedAssetNames || []).slice(0, 5).map((name) => <p key={name}>- {name}</p>)}<p>最近一次导入： {imports[0]?.createdAt ? new Date(imports[0].createdAt).toLocaleString() : zh.none}</p></div>
                  </div>
                  {file.folder === 'images' ? <button onClick={() => setLightboxFile(file)} className="h-24 w-24 shrink-0 border border-walnut/20 bg-paper p-1"><img src={file.url} alt={file.name} className="h-full w-full object-cover sepia" /></button> : null}<div className="flex shrink-0 flex-col gap-2">
                    {file.folder === 'images' ? <button onClick={() => setLightboxFile(file)} disabled={busy || !apiOnline} className="stamp border-crimson text-crimson disabled:opacity-50">{file.ocr?.text ? '查看识别文本' : '识别文字'}</button> : null}
                    {file.folder === 'images' && file.ocr?.text ? <button onClick={() => setLightboxFile(file)} disabled={busy || !apiOnline} className="stamp border-brass text-brass disabled:opacity-50">用识别文本建档</button> : null}
                    <button onClick={() => setCreatingFrom(file)} disabled={busy || !apiOnline} title={!apiOnline ? zh.disabledReadOnly : undefined} className="stamp border-brass text-brass disabled:cursor-not-allowed disabled:opacity-50">建档</button>
                    <button onClick={() => setBinding(file)} disabled={busy || !apiOnline} title={!apiOnline ? zh.disabledReadOnly : undefined} className="stamp border-brass text-brass disabled:cursor-not-allowed disabled:opacity-50">绑定</button>
                    <button onClick={() => setSelected([file.id])} className="stamp border-brass text-brass">相关档案</button><button onClick={() => void cleanFileTestDrafts(file)} disabled={busy || !apiOnline} className="stamp border-brass text-brass disabled:opacity-50">清理草稿</button><button onClick={() => setDeleting(file)} disabled={busy || !apiOnline} title={!apiOnline ? zh.disabledReadOnly : undefined} className="stamp border-crimson text-crimson disabled:cursor-not-allowed disabled:opacity-50">删除</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <EvidenceCreateDossierDialog file={creatingFrom} bundle={bundle} onClose={() => setCreatingFrom(undefined)} onCreated={onCreated} onError={(message) => notify({ tone: 'error', title: message })} />
      <FileBindDialog file={binding} bundle={bundle} onClose={() => setBinding(undefined)} onSave={(metadata) => void saveBinding(metadata)} />
      {lightboxFile ? <EvidenceLightbox image={lightboxFile} imageList={visibleFiles.filter((file) => file.folder === 'images' || file.type?.startsWith('image/'))} initialIndex={Math.max(0, visibleFiles.filter((file) => file.folder === 'images' || file.type?.startsWith('image/')).findIndex((file) => file.id === lightboxFile.id))} assets={assets} onClose={() => setLightboxFile(null)} onBind={setBinding} apiOnline={apiOnline} notify={notify} /> : null}
      <ConfirmDialog open={Boolean(deleting)} title="删除证物？" message={`此证物已绑定 ${deleting?.linkedAssetIds?.length ?? 0} 个档案。${(deleting?.linkedAssetIds?.length ?? 0) > 0 ? ' 已绑定档案：' + linkedNames(deleting as UploadedFileRecord).join(', ') : ''}`} confirmLabel="删除证物" onCancel={() => setDeleting(undefined)} onConfirm={() => void confirmDelete()} />
    </section>
  );
}

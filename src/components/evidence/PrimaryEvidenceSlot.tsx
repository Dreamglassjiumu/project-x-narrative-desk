import { useMemo, useRef, useState } from 'react';
import type { AnyAsset } from '../../data';
import type { AssetBundle, UploadedFileRecord } from '../../utils/api';
import { archiveErrorMessage, flattenAssets, updateAsset, updateUpload, uploadFiles } from '../../utils/api';
import { assetTypeFor } from '../../utils/assetHelpers';
import type { ArchiveNotifier } from '../ui/ArchiveNotice';
import { ConfirmDialog } from '../forms/ConfirmDialog';
import { TagChipInput } from '../forms/TagChipInput';
import { fileUsageOptions } from '../library/EvidenceUsageBadge';
import { fileUsageLabel, zh } from '../../i18n/zhCN';
import { EvidenceLightbox } from './EvidenceLightbox';

const formatSize = (size: number) => size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;
const usageFilters = ['all_images','未绑定_images','linked_images','character_reference','faction_reference','district_reference','poi_reference','storyline_reference'];
const imageFile = (file: UploadedFileRecord) => file.folder === 'images' || file.type?.startsWith('image/');

export function PrimaryEvidenceSlot({ asset, bundle, files, readOnly, onAssetSaved, onFilesChanged, notify }: { asset: AnyAsset; bundle: AssetBundle; files: UploadedFileRecord[]; readOnly?: boolean; onAssetSaved?: (asset: AnyAsset) => void; onFilesChanged?: (files: UploadedFileRecord[]) => void; notify?: ArchiveNotifier }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all_images');
  const [editingFile, setEditingFile] = useState<UploadedFileRecord | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [fileUsage, setFileUsage] = useState('other');
  const [note, setNote] = useState('');
  const assets = useMemo(() => flattenAssets(bundle), [bundle]);
  const imageFiles = useMemo(() => files.filter(imageFile), [files]);
  const primary = files.find((file) => file.id === asset.primaryEvidenceId || file.filename === asset.primaryEvidenceId);
  const linkedNames = (file: UploadedFileRecord) => file.linkedAssetIds?.map((id) => assets.find((item) => item.id === id)?.name ?? id) ?? [];
  const primaryFor = (file: UploadedFileRecord) => assets.filter((item) => item.primaryEvidenceId === file.id || item.primaryEvidenceId === file.filename).map((item) => item.name);
  const visible = imageFiles.filter((file) => {
    const haystack = [file.name, file.filename, file.fileUsage, ...(file.tags || []), ...linkedNames(file)].join(' ').toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (filter === '未绑定_images') return !(file.linkedAssetIds?.length);
    if (filter === 'linked_images') return Boolean(file.linkedAssetIds?.length);
    if (filter.endsWith('_reference')) return file.fileUsage === filter;
    return true;
  });

  const savePrimary = async (file: UploadedFileRecord) => {
    if (readOnly) return;
    try {
      const savedAsset = await updateAsset(assetTypeFor(asset), asset.id, { primaryEvidenceId: file.id });
      const savedFile = await updateUpload(file.id, { tags: file.tags ?? [], fileUsage: file.fileUsage || 'other', linkedAssetIds: [...new Set([...(file.linkedAssetIds ?? []), asset.id])] });
      onAssetSaved?.(savedAsset);
      onFilesChanged?.(files.map((item) => item.id === savedFile.id ? savedFile : item));
      setPickerOpen(false);
      notify?.({ tone: 'success', title: '主证物图已设置。', detail: `${asset.name} ⇢ ${file.name}` });
    } catch (error) { notify?.({ tone: 'error', title: archiveErrorMessage(error, '写入失败。') }); }
  };

  const uploadPrimary = async (fileList: FileList | null) => {
    if (!fileList?.length || readOnly) return;
    try {
      const uploaded = await uploadFiles(fileList, { linkedAssetIds: [asset.id], fileUsage: `${assetTypeFor(asset).replace(/s$/, '')}_reference`, tags: ['primary-evidence'] });
      const file = uploaded[0];
      const savedAsset = await updateAsset(assetTypeFor(asset), asset.id, { primaryEvidenceId: file.id });
      onAssetSaved?.(savedAsset);
      onFilesChanged?.([...uploaded, ...files]);
      setPickerOpen(false);
      notify?.({ tone: 'success', title: '主证物图已上传。', detail: `${asset.name} ⇢ ${file.name}` });
    } catch (error) { notify?.({ tone: 'error', title: archiveErrorMessage(error, '上传失败。') }); }
  };

  const removePrimary = async () => {
    try {
      const saved = await updateAsset(assetTypeFor(asset), asset.id, { primaryEvidenceId: '' });
      onAssetSaved?.(saved);
      setConfirmRemove(false);
      notify?.({ tone: 'success', title: '主图已移除。', detail: '原始证物文件仍保留在本地资料库。' });
    } catch (error) { notify?.({ tone: 'error', title: archiveErrorMessage(error, '写入失败。') }); }
  };
  const startEdit = (file: UploadedFileRecord) => { setEditingFile(file); setTags(file.tags ?? []); setFileUsage(file.fileUsage || 'other'); setNote(file.note || file.caption || ''); };
  const saveMetadata = async () => {
    if (!editingFile) return;
    try {
      const saved = await updateUpload(editingFile.id, { tags, fileUsage, linkedAssetIds: editingFile.linkedAssetIds ?? [], note, caption: note });
      onFilesChanged?.(files.map((item) => item.id === saved.id ? saved : item));
      setEditingFile(null); notify?.({ tone: 'success', title: '证物信息已更新。' });
    } catch (error) { notify?.({ tone: 'error', title: archiveErrorMessage(error, '写入失败。') }); }
  };

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-3"><div><p className="type-label text-crimson">PRIMARY EVIDENCE / 主证物图</p><h3 className="font-display text-2xl text-espresso">主证物图</h3></div>{primary ? <button className="stamp border-brass text-brass disabled:opacity-50" disabled={readOnly} onClick={() => setPickerOpen(true)}>替换 / 编辑</button> : null}</div>
      {primary ? <div className="border-2 border-brass/40 bg-espresso/10 p-3 shadow-dossier"><button className="block w-full overflow-hidden border-[10px] border-paper bg-paper text-left shadow-noir" onClick={() => setLightboxOpen(true)}><img src={primary.url} alt={primary.name} className={`${assetTypeFor(asset) === 'characters' ? 'mx-auto max-h-[420px] w-full max-w-sm object-cover aspect-[4/5]' : 'max-h-[360px] w-full object-cover aspect-video'} sepia-[0.2]`} /></button><div className="mt-3 grid gap-2 font-mono text-xs text-walnut/70 md:grid-cols-[1fr_auto]"><div><p className="truncate text-espresso">{primary.name}</p><p>{primary.type || zh.unknown} · {formatSize(primary.size)} · 已绑定证物： {linkedNames(primary).join(', ') || zh.none}</p><p>主图用于： {primaryFor(primary).join(', ') || asset.name}</p></div><div className="flex flex-wrap gap-2"><button className="stamp border-brass text-brass" onClick={() => setLightboxOpen(true)}>查看</button><button className="stamp border-brass text-brass disabled:opacity-50" disabled={readOnly} onClick={() => setPickerOpen(true)}>替换图片</button><button className="stamp border-brass text-brass disabled:opacity-50" disabled={readOnly} onClick={() => startEdit(primary)}>编辑信息</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={readOnly} onClick={() => setConfirmRemove(true)}>移除</button></div></div></div> : <button disabled={readOnly} onClick={() => setPickerOpen(true)} className="w-full border-2 border-dashed border-brass/50 bg-[linear-gradient(135deg,rgba(76,53,35,0.16),rgba(214,160,75,0.10))] p-8 text-center shadow-dossier disabled:cursor-not-allowed disabled:opacity-60"><div className="mx-auto grid h-44 max-w-xl place-items-center border-[10px] border-paper bg-espresso/10 shadow-noir"><div><p className="font-display text-3xl text-espresso">暂无主图</p><p className="mt-2 font-mono text-xs uppercase tracking-[0.22em] text-walnut/70">将主证物图放在这里</p><p className="mt-1 text-sm text-walnut/70">点击绑定或上传图片</p></div></div></button>}

      {pickerOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-espresso/80 p-4 backdrop-blur-sm"><div className="dossier-panel max-h-[90vh] w-full max-w-5xl overflow-y-auto p-6"><div className="flex items-start justify-between gap-3"><div><p className="type-label text-crimson">主证物图选择器</p><h2 className="font-display text-3xl text-espresso">绑定档案图片</h2><p className="text-sm text-walnut/70">{asset.name}</p></div><button className="stamp border-walnut text-walnut" onClick={() => setPickerOpen(false)}>关闭</button></div><div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]"><div className="border border-brass/30 bg-walnut/10 p-4"><p className="section-title">上传新图片</p><label className="mt-3 inline-flex evidence-button cursor-pointer">上传 PNG / JPG / WEBP<input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void uploadPrimary(event.target.files)} /></label>{primary ? <button className="stamp mt-4 border-crimson text-crimson" onClick={() => setConfirmRemove(true)}>移除主图</button> : null}</div><div><div className="mb-3 grid gap-2 md:grid-cols-2"><input className="paper-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索文件名、标签、已绑定档案" /><select className="paper-input" value={filter} onChange={(e) => setFilter(e.target.value)}>{usageFilters.map((item) => <option key={item} value={item}>{fileUsageLabel(item)}</option>)}</select></div><div className="grid max-h-[58vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">{visible.map((file) => <div key={file.id} className="border border-walnut/20 bg-espresso/5 p-3"><img src={file.url} alt={file.name} className="h-36 w-full border border-walnut/20 object-cover sepia" /><p className="mt-2 truncate font-mono text-xs text-espresso">{file.name}</p><p className="text-xs text-walnut/60">{fileUsageLabel(file.fileUsage)} · {linkedNames(file).join(', ') || '未绑定'}</p><div className="mt-2 flex flex-wrap gap-2"><button className="stamp border-crimson text-crimson" onClick={() => void savePrimary(file)}>设为主证物图</button><button className="stamp border-brass text-brass" onClick={() => startEdit(file)}>编辑信息</button></div></div>)}</div></div></div></div></div> : null}
      {editingFile ? <div className="fixed inset-0 z-[60] grid place-items-center bg-espresso/80 p-4"><div className="dossier-panel w-full max-w-2xl p-6"><p className="type-label text-crimson">编辑证物信息</p><h2 className="font-display text-2xl text-espresso">{editingFile.name}</h2><div className="mt-4 grid gap-4"><TagChipInput label="证物标签" value={tags} onChange={setTags} /><label><span className="field-label">文件用途</span><select className="paper-input" value={fileUsage} onChange={(e) => setFileUsage(e.target.value)}>{fileUsageOptions.map((item) => <option key={item} value={item}>{fileUsageLabel(item)}</option>)}</select></label><label><span className="field-label">备注 / 说明</span><textarea className="paper-input min-h-24" value={note} onChange={(e) => setNote(e.target.value)} /></label></div><div className="mt-5 flex justify-end gap-2"><button className="stamp border-walnut text-walnut" onClick={() => setEditingFile(null)}>取消</button><button className="evidence-button" onClick={() => void saveMetadata()}>保存信息</button></div></div></div> : null}
      <ConfirmDialog open={confirmRemove} title="移除主图？" message="只会清除主图字段。原始证物文件和档案绑定仍保留在本地资料库。" confirmLabel="移除 PRIMARY" onCancel={() => setConfirmRemove(false)} onConfirm={() => void removePrimary()} />
      {lightboxOpen && primary ? <EvidenceLightbox image={primary} imageList={imageFiles} initialIndex={Math.max(0, imageFiles.findIndex((file) => file.id === primary.id))} assets={assets} onClose={() => setLightboxOpen(false)} onSetPrimary={(file) => void savePrimary(file)} /> : null}
    </section>
  );
}

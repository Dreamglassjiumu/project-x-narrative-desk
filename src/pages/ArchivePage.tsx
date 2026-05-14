import { useEffect, useMemo, useState } from 'react';
import type { AnyAsset } from '../data';
import { AssetCard } from '../components/cards/AssetCard';
import { DetailPanel } from '../components/detail/DetailPanel';
import { AssetFormDrawer } from '../components/forms/AssetFormDrawer';
import { ConfirmDialog } from '../components/forms/ConfirmDialog';
import { DossierTemplatePicker } from '../components/templates/DossierTemplatePicker';
import type { DossierTemplateId } from '../components/templates/templateDefaults';
import { templateById } from '../components/templates/templateDefaults';
import type { AssetBundle, UploadedFileRecord } from '../utils/api';
import { archiveErrorMessage, createAsset, fetchAssetBundle, getDeleteImpact, mergeDossiers, safeDeleteDossier, updateAsset } from '../utils/api';
import type { ArchiveNotifier } from '../components/ui/ArchiveNotice';
import type { AssetType } from '../utils/assetHelpers';
import { assetTypeFor } from '../utils/assetHelpers';
import { getCompleteness, type CompletenessStatus } from '../utils/completeness';
import { groupAssets, groupOptionsForType, type GroupByMode } from '../utils/grouping';
import { getAssetHitTypes, searchAssets, type AssetFilters } from '../utils/search';
import { statusLabel, spoilerLabel } from '../i18n/zhCN';

export function ArchivePage({ type, assets, bundle, files, query, eyebrow, title, readOnly, onAssetsChanged, onFilesChanged, notify }: { type: AssetType; assets: AnyAsset[]; bundle: AssetBundle; files: UploadedFileRecord[]; query: string; eyebrow: string; title: string; readOnly: boolean; onAssetsChanged: (bundle: AssetBundle) => void; onFilesChanged: (files: UploadedFileRecord[]) => void; notify: ArchiveNotifier }) {
  const [filters, setFilters] = useState<AssetFilters>({});
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessStatus | ''>('');
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');
  const baseFiltered = useMemo(() => searchAssets(assets, query, filters), [assets, query, filters]);
  const filtered = useMemo(() => completenessFilter ? baseFiltered.filter((asset) => getCompleteness(asset, files).status === completenessFilter) : baseFiltered, [baseFiltered, completenessFilter, files]);
  const grouped = useMemo(() => groupAssets(filtered, groupBy), [filtered, groupBy]);
  const [selectedId, setSelectedId] = useState<string | undefined>(filtered[0]?.id);
  const [editing, setEditing] = useState<AnyAsset | undefined>();
  const [creating, setCreating] = useState<{ type: AssetType; templateId: DossierTemplateId } | undefined>();
  const [pickingType, setPickingType] = useState<AssetType | undefined>();
  const [deleting, setDeleting] = useState<AnyAsset | undefined>();
  const [deleteImpact, setDeleteImpact] = useState<{ relatedCount: number; pitchCount: number; evidenceCount: number; draftCount: number } | null>(null);
  const [merging, setMerging] = useState<AnyAsset | undefined>();
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeMode, setMergeMode] = useState<'target' | 'source' | 'append'>('target');
  const selected = filtered.find((asset) => asset.id === selectedId) ?? filtered[0];

  useEffect(() => {
    const onOpenDossier = (event: Event) => {
      const detail = (event as CustomEvent<{ assetId?: string }>).detail;
      if (detail?.assetId && assets.some((asset) => asset.id === detail.assetId)) setSelectedId(detail.assetId);
    };
    window.addEventListener('projectx:open-dossier', onOpenDossier);
    return () => window.removeEventListener('projectx:open-dossier', onOpenDossier);
  }, [assets]);

  const categories = [...new Set(assets.map((asset) => asset.category).filter(Boolean))];
  const tags = [...new Set(assets.flatMap((asset) => asset.tags))];

  const replaceRecord = (recordType: AssetType, asset: AnyAsset) => onAssetsChanged({ ...bundle, [recordType]: (bundle[recordType] as AnyAsset[]).map((item) => item.id === asset.id ? asset : item) });
  const addRecord = (recordType: AssetType, asset: AnyAsset) => { onAssetsChanged({ ...bundle, [recordType]: [asset, ...(bundle[recordType] as AnyAsset[])] }); setSelectedId(asset.id); };
  const removeRecord = (recordType: AssetType, asset: AnyAsset) => { onAssetsChanged({ ...bundle, [recordType]: (bundle[recordType] as AnyAsset[]).filter((item) => item.id !== asset.id) }); setSelectedId(undefined); };
  const openDuplicate = (asset: AnyAsset) => { setSelectedId(asset.id); setEditing(undefined); };
  const previewDelete = async (asset: AnyAsset) => { setDeleting(asset); setDeleteImpact(null); try { const impact = await getDeleteImpact(asset.id, assetTypeFor(asset)); setDeleteImpact(impact); } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '删除影响预览失败。') }); } };
  const confirmMerge = async () => { if (!merging || !mergeTargetId) return; try { const result = await mergeDossiers({ sourceId: merging.id, sourceType: assetTypeFor(merging), targetId: mergeTargetId, summaryMode: mergeMode, detailsMode: mergeMode }); onAssetsChanged(await fetchAssetBundle()); setMerging(undefined); setMergeTargetId(''); notify({ tone: 'success', title: '档案合并完成。', detail: `备份：${result.backup?.filename || '已创建'}` }); } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '合并失败。') }); } };

  return (
    <div>
      <div className="mb-5 border border-brass/25 bg-walnut/40 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="type-label text-brass">{eyebrow}</p><h2 className="font-display text-3xl text-ivory">{title}</h2></div>
          <div className="flex flex-wrap gap-2"><button disabled={readOnly} title={readOnly ? '本地接口离线，当前为只读模式。' : undefined} onClick={() => setPickingType(type)} className="evidence-button disabled:cursor-not-allowed disabled:opacity-50">新建</button>{type === 'districts' ? <button disabled={readOnly} title={readOnly ? '本地接口离线，当前为只读模式。' : undefined} onClick={() => setPickingType('pois')} className="evidence-button disabled:cursor-not-allowed disabled:opacity-50">新建地点</button> : null}</div>
        </div>
        {readOnly ? <p className="mt-3 border border-crimson/40 bg-burgundy/45 p-2 font-mono text-xs text-paper">本地接口离线，当前为只读模式。</p> : null}
      </div>
      <div className="mb-5 grid gap-3 border border-brass/20 bg-walnut/30 p-3 md:grid-cols-6">
        <select className="paper-input" value={filters.category ?? ''} onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })}><option value="">全部类别</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="paper-input" value={filters.status ?? ''} onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}><option value="">全部状态</option>{['canon','draft','deprecated','under_review'].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select>
        <select className="paper-input" value={filters.spoilerLevel ?? ''} onChange={(e) => setFilters({ ...filters, spoilerLevel: e.target.value || undefined })}><option value="">全部保密等级</option>{['public','internal','secret'].map((item) => <option key={item} value={item}>{spoilerLabel(item)}</option>)}</select>
        <select className="paper-input" value={filters.tag ?? ''} onChange={(e) => setFilters({ ...filters, tag: e.target.value || undefined })}><option value="">全部标签</option>{tags.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="paper-input" value={completenessFilter} onChange={(e) => setCompletenessFilter(e.target.value as CompletenessStatus | '')}><option value="">全部完整度</option><option value="complete">完整</option><option value="needs_review">待补充</option><option value="incomplete">不完整</option></select>
        <select className="paper-input" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupByMode)}>{groupOptionsForType(type).map((item) => <option key={item.value} value={item.value}>分组： {item.label}</option>)}</select>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.key}>
              {groupBy !== 'none' ? <div className="mb-3 border-l-8 border-brass bg-espresso/80 px-4 py-2 shadow-dossier"><p className="type-label text-brass">档案分组</p><h3 className="font-display text-2xl capitalize text-ivory">{group.label} <span className="font-mono text-sm text-paper/55">({group.assets.length})</span></h3></div> : null}
              <div className="grid gap-4 md:grid-cols-2">{group.assets.map((asset) => <AssetCard key={asset.id} asset={asset} files={files} active={asset.id === selected?.id} onSelect={() => setSelectedId(asset.id)} />)}</div>
            </section>
          ))}
          {!filtered.length ? <div className="border border-dashed border-brass/40 bg-walnut/40 p-5 text-paper/70">没有符合当前搜索和筛选的档案。</div> : null}
          {query ? <p className="font-mono text-xs text-paper/50">搜索命中： {filtered.map((asset) => `${asset.name} [${getAssetHitTypes(asset, query).join(', ') || 'text'}]`).join(' · ')}</p> : null}
        </div>
        <DetailPanel asset={selected} bundle={bundle} files={files} onOpenRelated={(asset) => setSelectedId(asset.id)} onEdit={setEditing} onDelete={(asset) => void previewDelete(asset)} onMerge={(asset) => { setMerging(asset); setMergeTargetId(''); }} readOnly={readOnly} onAssetSaved={(asset) => replaceRecord(assetTypeFor(asset), asset)} onFilesChanged={onFilesChanged} notify={notify} />
      </div>
      <DossierTemplatePicker open={Boolean(pickingType)} type={pickingType} onClose={() => setPickingType(undefined)} onPick={(templateId) => { const template = templateById(templateId); setCreating({ type: template.type, templateId }); setPickingType(undefined); }} />
      <AssetFormDrawer open={Boolean(creating)} type={creating?.type ?? type} templateId={creating?.templateId} bundle={bundle} onClose={() => setCreating(undefined)} onOpenDuplicate={openDuplicate} onSubmit={async (asset) => {
        try { const saved = await createAsset(creating?.type ?? type, asset); addRecord(creating?.type ?? type, saved); notify({ tone: 'success', title: '档案已保存到本地 JSON。' }); }
        catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '写入失败。') }); throw error; }
      }} />
      <AssetFormDrawer open={Boolean(editing)} type={editing ? assetTypeFor(editing) : type} asset={editing} bundle={bundle} onClose={() => setEditing(undefined)} onOpenDuplicate={openDuplicate} onSubmit={async (asset) => {
        if (!editing) return;
        const recordType = assetTypeFor(editing);
        try { const saved = await updateAsset(recordType, editing.id, asset); replaceRecord(recordType, saved); notify({ tone: 'success', title: '档案已更新。' }); }
        catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '写入失败。') }); throw error; }
      }} />

      {merging ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="dossier-panel max-h-[90vh] w-full max-w-xl overflow-auto p-5"><p className="type-label text-crimson">合并档案 · DOSSIER REPAIR</p><h3 className="font-display text-2xl text-espresso">将 {merging.name} 合并到目标档案</h3><p className="mt-2 text-sm text-walnut/70">执行前会自动备份；Source 将删除并替换所有引用，uploads 原始文件不会删除。summary/details 不会自动覆盖，请选择处理方式。</p><select className="paper-input mt-3" value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}><option value="">选择保留的目标档案</option>{assets.filter((asset) => asset.id !== merging.id).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select><select className="paper-input mt-3" value={mergeMode} onChange={(e) => setMergeMode(e.target.value as 'target' | 'source' | 'append')}><option value="target">正文保留目标</option><option value="source">正文使用来源</option><option value="append">正文追加来源到目标后面</option></select><div className="mt-4 flex justify-end gap-2"><button className="stamp border-brass text-brass" onClick={() => setMerging(undefined)}>取消</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!mergeTargetId} onClick={() => void confirmMerge()}>确认合并</button></div></div></div> : null}
      <ConfirmDialog open={Boolean(deleting)} title="安全删除档案？" message={`此操作会删除 ${deleting?.name ?? '此档案'}，并从 ${deleteImpact?.relatedCount ?? '…'} 条关联档案、${deleteImpact?.pitchCount ?? '…'} 条 Pitch、${deleteImpact?.evidenceCount ?? '…'} 个证物文件中移除引用；草稿标记 ${deleteImpact?.draftCount ?? '…'} 条。执行前会自动备份，uploads 原始文件不会删除。`} confirmLabel="安全删除档案" onCancel={() => { setDeleting(undefined); setDeleteImpact(null); }} onConfirm={async () => {
        if (!deleting) return;
        const recordType = assetTypeFor(deleting);
        try { const result = await safeDeleteDossier(deleting.id, recordType); onAssetsChanged(await fetchAssetBundle()); setSelectedId(undefined); setDeleting(undefined); setDeleteImpact(null); notify({ tone: 'success', title: '档案已安全删除。', detail: `备份：${result.backup.filename}` }); }
        catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '删除失败。') }); }
      }} />
    </div>
  );
}

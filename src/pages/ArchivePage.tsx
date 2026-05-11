import { useMemo, useState } from 'react';
import type { AnyAsset } from '../data';
import { AssetCard } from '../components/cards/AssetCard';
import { DetailPanel } from '../components/detail/DetailPanel';
import { AssetFormDrawer } from '../components/forms/AssetFormDrawer';
import { ConfirmDialog } from '../components/forms/ConfirmDialog';
import { DossierTemplatePicker } from '../components/templates/DossierTemplatePicker';
import type { DossierTemplateId } from '../components/templates/templateDefaults';
import { templateById } from '../components/templates/templateDefaults';
import type { AssetBundle, UploadedFileRecord } from '../utils/api';
import { archiveErrorMessage, createAsset, deleteAsset, updateAsset } from '../utils/api';
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
  const selected = filtered.find((asset) => asset.id === selectedId) ?? filtered[0];
  const categories = [...new Set(assets.map((asset) => asset.category).filter(Boolean))];
  const tags = [...new Set(assets.flatMap((asset) => asset.tags))];

  const replaceRecord = (recordType: AssetType, asset: AnyAsset) => onAssetsChanged({ ...bundle, [recordType]: (bundle[recordType] as AnyAsset[]).map((item) => item.id === asset.id ? asset : item) });
  const addRecord = (recordType: AssetType, asset: AnyAsset) => { onAssetsChanged({ ...bundle, [recordType]: [asset, ...(bundle[recordType] as AnyAsset[])] }); setSelectedId(asset.id); };
  const removeRecord = (recordType: AssetType, asset: AnyAsset) => { onAssetsChanged({ ...bundle, [recordType]: (bundle[recordType] as AnyAsset[]).filter((item) => item.id !== asset.id) }); setSelectedId(undefined); };
  const openDuplicate = (asset: AnyAsset) => { setSelectedId(asset.id); setEditing(undefined); };

  return (
    <div>
      <div className="mb-5 border border-brass/25 bg-walnut/40 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="type-label text-brass">{eyebrow}</p><h2 className="font-display text-3xl text-ivory">{title}</h2></div>
          <div className="flex flex-wrap gap-2"><button disabled={readOnly} title={readOnly ? '本地接口离线，当前为只读模式。' : undefined} onClick={() => setPickingType(type)} className="evidence-button disabled:cursor-not-allowed disabled:opacity-50">新建档案</button>{type === 'districts' ? <button disabled={readOnly} title={readOnly ? '本地接口离线，当前为只读模式。' : undefined} onClick={() => setPickingType('pois')} className="evidence-button disabled:cursor-not-allowed disabled:opacity-50">新建地点</button> : null}</div>
        </div>
        {readOnly ? <p className="mt-3 border border-crimson/40 bg-burgundy/45 p-2 font-mono text-xs text-paper">本地接口离线，当前为只读模式。</p> : null}
      </div>
      <div className="mb-5 grid gap-3 border border-brass/20 bg-walnut/30 p-3 md:grid-cols-6">
        <select className="paper-input" value={filters.category ?? ''} onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })}><option value="">全部类别</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="paper-input" value={filters.status ?? ''} onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}><option value="">全部状态</option>{['canon','draft','deprecated','under_review'].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select>
        <select className="paper-input" value={filters.spoilerLevel ?? ''} onChange={(e) => setFilters({ ...filters, spoilerLevel: e.target.value || undefined })}><option value="">全部保密等级</option>{['public','internal','secret'].map((item) => <option key={item} value={item}>{spoilerLabel(item)}</option>)}</select>
        <select className="paper-input" value={filters.tag ?? ''} onChange={(e) => setFilters({ ...filters, tag: e.target.value || undefined })}><option value="">全部标签</option>{tags.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="paper-input" value={completenessFilter} onChange={(e) => setCompletenessFilter(e.target.value as CompletenessStatus | '')}><option value="">全部完整度</option><option value="complete">完整</option><option value="needs_review">需要补充</option><option value="incomplete">不完整</option></select>
        <select className="paper-input" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupByMode)}>{groupOptionsForType(type).map((item) => <option key={item.value} value={item.value}>分组： {item.label}</option>)}</select>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.key}>
              {groupBy !== 'none' ? <div className="mb-3 border-l-8 border-brass bg-espresso/80 px-4 py-2 shadow-dossier"><p className="type-label text-brass">FILE CABINET DRAWER</p><h3 className="font-display text-2xl capitalize text-ivory">{group.label} <span className="font-mono text-sm text-paper/55">({group.assets.length})</span></h3></div> : null}
              <div className="grid gap-4 md:grid-cols-2">{group.assets.map((asset) => <AssetCard key={asset.id} asset={asset} files={files} active={asset.id === selected?.id} onSelect={() => setSelectedId(asset.id)} />)}</div>
            </section>
          ))}
          {!filtered.length ? <div className="border border-dashed border-brass/40 bg-walnut/40 p-5 text-paper/70">没有符合当前搜索和筛选的档案。</div> : null}
          {query ? <p className="font-mono text-xs text-paper/50">搜索命中： {filtered.map((asset) => `${asset.name} [${getAssetHitTypes(asset, query).join(', ') || 'text'}]`).join(' · ')}</p> : null}
        </div>
        <DetailPanel asset={selected} bundle={bundle} files={files} onOpenRelated={(asset) => setSelectedId(asset.id)} onEdit={setEditing} onDelete={setDeleting} readOnly={readOnly} onAssetSaved={(asset) => replaceRecord(assetTypeFor(asset), asset)} onFilesChanged={onFilesChanged} notify={notify} />
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
      <ConfirmDialog open={Boolean(deleting)} title="删除档案？" message={`将 ${deleting?.name ?? '此档案'} 从本地 JSON 删除。已绑定证物文件会保留其信息。`} confirmLabel="删除档案" onCancel={() => setDeleting(undefined)} onConfirm={async () => {
        if (!deleting) return;
        const recordType = assetTypeFor(deleting);
        try { await deleteAsset(recordType, deleting.id); removeRecord(recordType, deleting); setDeleting(undefined); notify({ tone: 'success', title: '档案已删除。' }); }
        catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, '删除失败。') }); }
      }} />
    </div>
  );
}

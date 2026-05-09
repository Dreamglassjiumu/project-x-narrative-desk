import { useMemo, useState } from 'react';
import type { AnyAsset } from '../data';
import { AssetCard } from '../components/cards/AssetCard';
import { DetailPanel } from '../components/detail/DetailPanel';
import { AssetFormDrawer } from '../components/forms/AssetFormDrawer';
import { ConfirmDialog } from '../components/forms/ConfirmDialog';
import type { AssetBundle, UploadedFileRecord } from '../utils/api';
import { archiveErrorMessage, createAsset, deleteAsset, updateAsset } from '../utils/api';
import type { ArchiveNotifier } from '../components/ui/ArchiveNotice';
import type { AssetType } from '../utils/assetHelpers';
import { assetTypeFor } from '../utils/assetHelpers';
import { getAssetHitTypes, searchAssets, type AssetFilters } from '../utils/search';

export function ArchivePage({ type, assets, bundle, files, query, eyebrow, title, readOnly, onAssetsChanged, notify }: { type: AssetType; assets: AnyAsset[]; bundle: AssetBundle; files: UploadedFileRecord[]; query: string; eyebrow: string; title: string; readOnly: boolean; onAssetsChanged: (bundle: AssetBundle) => void; notify: ArchiveNotifier }) {
  const [filters, setFilters] = useState<AssetFilters>({});
  const filtered = useMemo(() => searchAssets(assets, query, filters), [assets, query, filters]);
  const [selectedId, setSelectedId] = useState<string | undefined>(filtered[0]?.id);
  const [editing, setEditing] = useState<AnyAsset | undefined>();
  const [creating, setCreating] = useState<AssetType | undefined>();
  const [deleting, setDeleting] = useState<AnyAsset | undefined>();
  const selected = filtered.find((asset) => asset.id === selectedId) ?? filtered[0];
  const categories = [...new Set(assets.map((asset) => asset.category).filter(Boolean))];
  const tags = [...new Set(assets.flatMap((asset) => asset.tags))];

  const replaceRecord = (recordType: AssetType, asset: AnyAsset) => onAssetsChanged({ ...bundle, [recordType]: (bundle[recordType] as AnyAsset[]).map((item) => item.id === asset.id ? asset : item) });
  const addRecord = (recordType: AssetType, asset: AnyAsset) => { onAssetsChanged({ ...bundle, [recordType]: [asset, ...(bundle[recordType] as AnyAsset[])] }); setSelectedId(asset.id); };
  const removeRecord = (recordType: AssetType, asset: AnyAsset) => { onAssetsChanged({ ...bundle, [recordType]: (bundle[recordType] as AnyAsset[]).filter((item) => item.id !== asset.id) }); setSelectedId(undefined); };

  return (
    <div>
      <div className="mb-5 border border-brass/25 bg-walnut/40 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="type-label text-brass">{eyebrow}</p><h2 className="font-display text-3xl text-ivory">{title}</h2></div>
          <div className="flex flex-wrap gap-2"><button disabled={readOnly} title={readOnly ? 'Local API offline. Archive is read-only.' : undefined} onClick={() => setCreating(type)} className="evidence-button disabled:cursor-not-allowed disabled:opacity-50">New Record / 新建档案</button>{type === 'districts' ? <button disabled={readOnly} title={readOnly ? 'Local API offline. Archive is read-only.' : undefined} onClick={() => setCreating('pois')} className="evidence-button disabled:cursor-not-allowed disabled:opacity-50">New POI / 新建地点</button> : null}</div>
        </div>
        {readOnly ? <p className="mt-3 border border-crimson/40 bg-burgundy/45 p-2 font-mono text-xs text-paper">Local API offline. Archive is read-only.</p> : null}
      </div>
      <div className="mb-5 grid gap-3 border border-brass/20 bg-walnut/30 p-3 md:grid-cols-5">
        <select className="paper-input" value={filters.category ?? ''} onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="paper-input" value={filters.status ?? ''} onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}><option value="">All status</option>{['canon','draft','deprecated','under_review'].map((item) => <option key={item}>{item}</option>)}</select>
        <select className="paper-input" value={filters.spoilerLevel ?? ''} onChange={(e) => setFilters({ ...filters, spoilerLevel: e.target.value || undefined })}><option value="">All spoiler</option>{['public','internal','secret'].map((item) => <option key={item}>{item}</option>)}</select>
        <select className="paper-input" value={filters.tag ?? ''} onChange={(e) => setFilters({ ...filters, tag: e.target.value || undefined })}><option value="">All tags</option>{tags.map((item) => <option key={item}>{item}</option>)}</select>
        <button className="stamp border-brass text-brass" onClick={() => setFilters({})}>CLEAR FILTERS</button>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((asset) => <div key={asset.id}><AssetCard asset={asset} active={selected?.id === asset.id} onSelect={() => setSelectedId(asset.id)} />{query ? <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-paper/60">Hit: {getAssetHitTypes(asset, query).join(', ') || 'metadata'} · Type: {assetTypeFor(asset)}</p> : null}</div>)}
        </div>
        <DetailPanel asset={selected} bundle={bundle} files={files} readOnly={readOnly} onOpenRelated={(asset) => setSelectedId(asset.id)} onEdit={setEditing} onDelete={setDeleting} />
      </div>
      <AssetFormDrawer open={Boolean(creating)} type={creating ?? type} bundle={bundle} onClose={() => setCreating(undefined)} onSubmit={async (asset) => { try { const recordType = creating ?? type; addRecord(recordType, await createAsset(recordType, asset)); notify({ tone: 'success', title: 'Dossier filed into local archive.' }); } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, 'Write failed') }); throw error; } }} />
      <AssetFormDrawer open={Boolean(editing)} type={editing ? assetTypeFor(editing) : type} asset={editing} bundle={bundle} onClose={() => setEditing(undefined)} onSubmit={async (asset) => { if (!editing) return; try { const recordType = assetTypeFor(editing); replaceRecord(recordType, await updateAsset(recordType, editing.id, asset)); notify({ tone: 'success', title: 'Dossier updated.' }); } catch (error) { notify({ tone: 'error', title: archiveErrorMessage(error, 'Write failed') }); throw error; } }} />
      <ConfirmDialog open={Boolean(deleting)} title="Remove Dossier?" message="This dossier will be removed from the local archive." confirmLabel="DELETE DOSSIER" onCancel={() => setDeleting(undefined)} onConfirm={() => { if (!deleting) return; const recordType = assetTypeFor(deleting); void deleteAsset(recordType, deleting.id).then(() => { removeRecord(recordType, deleting); setDeleting(undefined); notify({ tone: 'success', title: 'Dossier removed from local archive.' }); }).catch((error) => notify({ tone: 'error', title: archiveErrorMessage(error, 'Write failed') })); }} />
    </div>
  );
}

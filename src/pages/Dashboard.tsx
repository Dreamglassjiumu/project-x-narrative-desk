import { useEffect, useState } from 'react';
import type { AnyAsset, PageKey } from '../data';
import { AssetCard } from '../components/cards/AssetCard';
import type { AssetBundle, BackupRecord, ImportHistoryRecord, UploadedFileRecord } from '../utils/api';
import { ArchiveIntakeBoard } from '../components/intake/ArchiveIntakeBoard';
import { archiveErrorMessage, cleanTestData, fetchAssetBundle, listBackups, listImportHistory, listUploads, previewBackup, previewTestDataClean, restoreBackup } from '../utils/api';

export function Dashboard({
  assets,
  allAssets,
  files,
  onSelectPage,
  loading,
  error,
  onAssetsChanged,
  onFilesChanged,
}: {
  assets: AssetBundle;
  allAssets: AnyAsset[];
  files: UploadedFileRecord[];
  onSelectPage: (page: PageKey) => void;
  loading: boolean;
  error: string | null;
  onAssetsChanged?: (bundle: AssetBundle) => void;
  onFilesChanged?: (files: UploadedFileRecord[]) => void;
}) {
  const secretCount = allAssets.filter((asset) => asset.spoilerLevel === 'secret').length;
  const stats = [
    ['帮派档案', assets.factions.length, 'factions'],
    ['区域与地点', assets.districts.length + assets.pois.length, 'districts'],
    ['角色卷宗', assets.characters.length, 'characters'],
    ['剧情线', assets.storylines.length, 'storylines'],
  ] as const;
  const [history, setHistory] = useState<ImportHistoryRecord[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [deleteUploads, setDeleteUploads] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [testPreview, setTestPreview] = useState<Record<string, number> | null>(null);
  const [backupPreviewName, setBackupPreviewName] = useState('');
  const [backupPreviewCounts, setBackupPreviewCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => { void listImportHistory().then((records) => setHistory(records.slice(0, 5))).catch(() => undefined); void listBackups().then(setBackups).catch(() => undefined); }, []);
  const refreshMaintenance = async () => { setHistory((await listImportHistory()).slice(0, 5)); setBackups(await listBackups()); onAssetsChanged?.(await fetchAssetBundle()); onFilesChanged?.(await listUploads().catch(() => files)); };
  const previewClean = async () => { try { const preview = await previewTestDataClean(deleteUploads); setTestPreview(preview.counts); setMaintenanceMessage('清理预览已生成，确认后才会执行。'); } catch (error) { setMaintenanceMessage(archiveErrorMessage(error, '清理预览失败。')); } };
  const runClean = async () => { if (!testPreview) return; if (!window.confirm('确认执行测试数据清理？执行前会自动创建备份，默认不会删除 uploads 原始文件。')) return; try { const result = await cleanTestData(deleteUploads); setMaintenanceMessage(`已清理档案 ${Object.values(result.deleted).reduce((a, b) => a + b, 0)} 条，草稿 ${result.drafts} 条，删除测试文件 ${result.deletedUploadFiles} 个；备份：${result.backup.filename}`); setTestPreview(null); await refreshMaintenance(); } catch (error) { setMaintenanceMessage(archiveErrorMessage(error, '清理失败。')); } };
  const inspectBackup = async (filename: string) => { try { const preview = await previewBackup(filename); setBackupPreviewName(filename); setBackupPreviewCounts(preview.counts); } catch (error) { setMaintenanceMessage(archiveErrorMessage(error, '备份预览失败。')); } };
  const restore = async (filename: string) => { if (!window.confirm(`二次确认：恢复 ${filename}？恢复前会创建 backup-before-restore，uploads 原始文件不会被删除。`)) return; try { const result = await restoreBackup(filename); setMaintenanceMessage(`已从 ${result.restoredFrom} 恢复；恢复前安全备份：${result.safetyBackup.filename}`); await refreshMaintenance(); } catch (error) { setMaintenanceMessage(archiveErrorMessage(error, '恢复失败。')); } };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden border border-brass/30 bg-[linear-gradient(120deg,rgba(74,22,26,.88),rgba(55,32,22,.82)),url('/noise.svg')] p-6 shadow-dossier">
        <p className="type-label text-brass">CONFIDENTIAL · SAN LIBRE CASE WALL</p>
        <h2 className="mt-2 max-w-4xl font-display text-4xl text-ivory lg:text-6xl">Project：X Narrative Desk</h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-paper/80">本地叙事资料库与 Pitch 写作台</p>
        <div className="mt-4 inline-flex border border-brass/30 bg-espresso/50 px-3 py-2 font-mono text-xs text-paper/70">
          {loading ? '本地数据连接中' : error ? '本地接口离线' : '本地数据已就绪 · 仅本地'}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => onSelectPage('pitch')} className="evidence-button">打开 Pitch 写作台</button>
          <button onClick={() => onSelectPage('library')} className="evidence-button bg-police/70">查看证物库</button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="border border-brass/30 bg-espresso/70 p-5 shadow-dossier">
          <p className="type-label text-brass">警局维护柜 · SYSTEM MAINTENANCE</p>
          <h3 className="font-display text-2xl text-ivory">数据清理 / 备份恢复</h3>
          <div className="mt-4 rounded border border-crimson/40 bg-burgundy/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-display text-xl text-paper">清理测试数据</p><p className="text-sm text-paper/65">先预览 Test Character / projectx_test / test 标签，再确认清理；真实文件默认保留。</p></div><label className="font-mono text-xs text-paper/70"><input type="checkbox" className="mr-2" checked={deleteUploads} onChange={(e) => setDeleteUploads(e.target.checked)} />同时删除测试上传文件</label></div>
            <div className="mt-3 flex flex-wrap gap-2"><button className="stamp border-brass text-brass" onClick={() => void previewClean()}>预览清理范围</button><button className="stamp border-crimson text-crimson disabled:opacity-50" disabled={!testPreview} onClick={() => void runClean()}>确认清理测试数据</button></div>
            {testPreview ? <div className="mt-3 grid gap-2 font-mono text-xs text-paper/75 md:grid-cols-3">{Object.entries(testPreview).map(([key, value]) => <span key={key} className="border border-brass/20 bg-black/20 p-2">{key}: {value}</span>)}</div> : null}
          </div>
          <div className="mt-4 rounded border border-brass/25 bg-walnut/35 p-4"><p className="font-display text-xl text-paper">备份保险箱</p><div className="mt-3 max-h-52 space-y-2 overflow-auto">{backups.slice(0, 8).map((backup) => <div key={backup.filename} className="flex flex-wrap items-center justify-between gap-2 border border-brass/20 bg-black/15 p-2 text-xs text-paper/75"><span>{backup.filename} · {(backup.size / 1024).toFixed(1)} KB</span><span className="flex gap-2"><button className="stamp border-brass text-brass" onClick={() => void inspectBackup(backup.filename)}>预览</button><button className="stamp border-crimson text-crimson" onClick={() => void restore(backup.filename)}>恢复</button></span></div>)}</div>{backupPreviewCounts ? <div className="mt-3 border border-brass/20 p-2 font-mono text-xs text-paper/70">{backupPreviewName}: {Object.entries(backupPreviewCounts).map(([k, v]) => `${k} ${v}`).join(' · ')}</div> : null}</div>
          {maintenanceMessage ? <p className="mt-3 border border-brass/25 bg-black/20 p-2 font-mono text-xs text-paper/80">{maintenanceMessage}</p> : null}
        </div>
        <div className="border border-brass/30 bg-walnut/55 p-5 shadow-dossier">
          <p className="type-label text-crimson">证物转移单 · IMPORT HISTORY</p><h3 className="font-display text-2xl text-ivory">最近导入历史</h3>
          <div className="mt-3 space-y-2">{history.length ? history.map((item) => <div key={item.id} className="border border-brass/20 bg-espresso/60 p-3"><p className="font-mono text-xs text-brass">{new Date(item.createdAt).toLocaleString()} · {item.status}</p><p className="text-sm text-paper">{item.sourceFileName || '未知来源'} 入库 {item.filedCount} 条</p><p className="text-xs text-paper/60">{item.filedAssetNames?.join(' / ') || '无档案名'} · 备份 {item.backupFileName || '未记录'}</p></div>) : <p className="text-sm text-paper/65">暂无导入记录。</p>}</div>
        </div>
      </section>
      <ArchiveIntakeBoard assets={assets} files={files} onSelectPage={onSelectPage} />
      <section className="grid gap-4 md:grid-cols-4">
        {stats.map(([label, value, page]) => (
          <button key={label} onClick={() => onSelectPage(page)} className="border border-brass/30 bg-espresso/70 p-4 text-left transition hover:-translate-y-1 hover:bg-walnut/75">
            <p className="type-label text-crimson">档案数量</p>
            <p className="mt-2 font-display text-4xl text-brass">{value}</p>
            <p className="text-paper/75">{label}</p>
          </button>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          {allAssets.slice(0, 4).map((asset) => <AssetCard key={asset.id} asset={asset} files={files} onSelect={() => onSelectPage(asset.category === 'Faction' ? 'factions' : asset.category === 'Character' ? 'characters' : asset.category === 'Storyline' ? 'storylines' : 'districts')} />)}
          {!loading && allAssets.length === 0 ? (
            <div className="border border-dashed border-brass/40 bg-walnut/40 p-5 text-paper/70">data 目录暂未读取到资料。请确认本地 API 已启动，并检查 data/*.json。</div>
          ) : null}
        </div>
        <aside className="border border-crimson/40 bg-burgundy/45 p-5 shadow-dossier">
          <p className="type-label text-crimson">风险提醒</p>
          <h3 className="font-display text-2xl text-ivory">{secretCount} 机密档案</h3>
          <p className="mt-3 text-paper/70">Pitch 中出现机密内容时会提示风险。</p>
          <div className="mt-5 border border-dashed border-brass/40 p-3 font-mono text-xs text-paper/60">LOCAL ONLY</div>
        </aside>
      </section>
    </div>
  );
}

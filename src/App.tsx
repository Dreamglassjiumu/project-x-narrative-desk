import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { characters, districts, factions, pois, storylines, type PageKey } from './data';
import { Dashboard } from './pages/Dashboard';
import { ArchivePage } from './pages/ArchivePage';
import { PitchDesk } from './pages/PitchDesk';
import { LocalLibrary } from './pages/LocalLibrary';
import { EvidenceIntake } from './pages/EvidenceIntake';
import { emptyAssetBundle, fetchAssetBundle, flattenAssets, listUploads, type AssetBundle, type UploadedFileRecord } from './utils/api';
import { ArchiveNoticeStack, type ArchiveNoticeMessage, type ArchiveNotifier } from './components/ui/ArchiveNotice';

const mockAssetBundle: AssetBundle = { factions, districts, pois, characters, storylines, 'design-assets': [], pitches: [] };

export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [query, setQuery] = useState('');
  const [assets, setAssets] = useState<AssetBundle>(mockAssetBundle);
  const [files, setFiles] = useState<UploadedFileRecord[]>([]);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [notices, setNotices] = useState<ArchiveNoticeMessage[]>([]);
  const apiOnline = !assetError;
  const allAssets = useMemo(() => flattenAssets(assets), [assets]);
  const districtAssets = useMemo(() => [...assets.districts, ...assets.pois], [assets.districts, assets.pois]);
  const notify: ArchiveNotifier = (notice) => {
    const id = Date.now() + Math.random();
    setNotices((current) => [...current.slice(-3), { ...notice, id }]);
    window.setTimeout(() => setNotices((current) => current.filter((item) => item.id !== id)), 5200);
  };

  const refreshAssets = async () => {
    const bundle = await fetchAssetBundle();
    setAssets({ ...emptyAssetBundle, ...bundle });
    setAssetError(null);
    setFiles(await listUploads().catch(() => []));
  };

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: PageKey }>).detail;
      if (detail?.view) setPage(detail.view);
    };
    window.addEventListener('projectx:navigate', onNavigate);
    window.addEventListener('projectx:open-dossier', onNavigate);
    return () => {
      window.removeEventListener('projectx:navigate', onNavigate);
      window.removeEventListener('projectx:open-dossier', onNavigate);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAssetBundle()
      .then(async (bundle) => {
        if (!cancelled) {
          setAssets({ ...emptyAssetBundle, ...bundle });
          setFiles(await listUploads().catch(() => []));
          setAssetError(null);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setAssets(mockAssetBundle);
          setFiles([]);
          setAssetError(`${error.message}; 正在使用内置演示档案`);
        }
      })
      .finally(() => { if (!cancelled) setLoadingAssets(false); });
    return () => { cancelled = true; };
  }, []);

  const archiveProps = { bundle: assets, files, query, readOnly: !apiOnline, onAssetsChanged: setAssets, onFilesChanged: setFiles, notify };
  const content = {
    dashboard: <Dashboard assets={assets} files={files} allAssets={allAssets} onSelectPage={setPage} loading={loadingAssets} error={assetError} onAssetsChanged={setAssets} onFilesChanged={setFiles} />,
    factions: <ArchivePage {...archiveProps} type="factions" assets={assets.factions} eyebrow="GANG LEDGER" title="帮派档案" />,
    districts: <ArchivePage {...archiveProps} type="districts" assets={districtAssets} eyebrow="CITY MAP & POI" title="区域与地点" />,
    characters: <ArchivePage {...archiveProps} type="characters" assets={assets.characters} eyebrow="MUGSHOT DOSSIERS" title="角色卷宗" />,
    storylines: <ArchivePage {...archiveProps} type="storylines" assets={assets.storylines} eyebrow="TYPEWRITER THREADS" title="剧情线" />,
    'design-assets': <ArchivePage {...archiveProps} type="design-assets" assets={assets['design-assets']} eyebrow="PROP ROOM" title="设计资料" />,
    pitch: <PitchDesk bundle={assets} assets={allAssets} apiOnline={apiOnline} onAssetsChanged={setAssets} notify={notify} />,
    library: <LocalLibrary bundle={assets} files={files} apiOnline={apiOnline} onFilesChanged={setFiles} onAssetsChanged={setAssets} notify={notify} onAssetsImported={(bundle) => { setAssets(bundle); void refreshAssets().catch(() => undefined); }} />,
    intake: <EvidenceIntake bundle={assets} files={files} apiOnline={apiOnline} onFilesChanged={setFiles} onAssetsChanged={setAssets} notify={notify} />,
  }[page];

  return (
    <AppShell page={page} onNavigate={setPage} query={query} onQueryChange={setQuery} apiOnline={apiOnline}>
      <ArchiveNoticeStack notices={notices} onDismiss={(id) => setNotices((current) => current.filter((notice) => notice.id !== id))} />
      {assetError && page !== 'library' ? <div className="mb-4 border border-crimson/50 bg-burgundy/45 p-3 font-mono text-sm text-paper">本地接口离线 · {assetError} · 本地接口离线，当前为只读模式。 · 当前使用内置 mock 演示资料；正式本地使用请运行 npm run dev:server</div> : null}
      {content}
    </AppShell>
  );
}

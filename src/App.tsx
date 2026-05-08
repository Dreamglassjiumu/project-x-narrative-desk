import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { characters, districts, factions, pois, storylines, type PageKey } from './data';
import { Dashboard } from './pages/Dashboard';
import { ArchivePage } from './pages/ArchivePage';
import { PitchDesk } from './pages/PitchDesk';
import { LocalLibrary } from './pages/LocalLibrary';
import { emptyAssetBundle, fetchAssetBundle, flattenAssets, type AssetBundle } from './utils/api';

const mockAssetBundle: AssetBundle = {
  factions,
  districts,
  pois,
  characters,
  storylines,
  pitches: [],
};

export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [query, setQuery] = useState('');
  const [assets, setAssets] = useState<AssetBundle>(mockAssetBundle);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const allAssets = useMemo(() => flattenAssets(assets), [assets]);
  const districtAssets = useMemo(() => [...assets.districts, ...assets.pois], [assets.districts, assets.pois]);

  useEffect(() => {
    let cancelled = false;
    fetchAssetBundle()
      .then((bundle) => {
        if (!cancelled) {
          setAssets({ ...emptyAssetBundle, ...bundle });
          setAssetError(null);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setAssets(mockAssetBundle);
          setAssetError(`${error.message}; using bundled demo dossiers`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAssets(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const content = {
    dashboard: <Dashboard assets={assets} allAssets={allAssets} onSelectPage={setPage} loading={loadingAssets} error={assetError} />,
    factions: <ArchivePage assets={assets.factions} query={query} eyebrow="GANG LEDGER" title="Factions / 帮派档案" />,
    districts: <ArchivePage assets={districtAssets} query={query} eyebrow="CITY MAP & POI" title="Districts & POI / 区域与地点" />,
    characters: <ArchivePage assets={assets.characters} query={query} eyebrow="MUGSHOT DOSSIERS" title="Characters / 角色卷宗" />,
    storylines: <ArchivePage assets={assets.storylines} query={query} eyebrow="TYPEWRITER THREADS" title="Storylines / 剧本线索" />,
    pitch: <PitchDesk assets={allAssets} />,
    library: <LocalLibrary />,
  }[page];

  return (
    <AppShell page={page} onNavigate={setPage} query={query} onQueryChange={setQuery}>
      {assetError && page !== 'library' ? (
        <div className="mb-4 border border-crimson/50 bg-burgundy/45 p-3 font-mono text-sm text-paper">
          LOCAL API OFFLINE · {assetError} · 当前使用内置 mock 演示资料；正式本地使用请运行 npm run dev:server
        </div>
      ) : null}
      {content}
    </AppShell>
  );
}

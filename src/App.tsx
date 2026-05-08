import { useMemo, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { characters, districts, factions, pois, storylines, type PageKey } from './data';
import { Dashboard } from './pages/Dashboard';
import { ArchivePage } from './pages/ArchivePage';
import { PitchDesk } from './pages/PitchDesk';
import { LocalLibrary } from './pages/LocalLibrary';

export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [query, setQuery] = useState('');
  const districtAssets = useMemo(() => [...districts, ...pois], []);

  const content = {
    dashboard: <Dashboard onSelectPage={setPage} />,
    factions: <ArchivePage assets={factions} query={query} eyebrow="GANG LEDGER" title="Factions / 帮派档案" />,
    districts: <ArchivePage assets={districtAssets} query={query} eyebrow="CITY MAP & POI" title="Districts & POI / 区域与地点" />,
    characters: <ArchivePage assets={characters} query={query} eyebrow="MUGSHOT DOSSIERS" title="Characters / 角色卷宗" />,
    storylines: <ArchivePage assets={storylines} query={query} eyebrow="TYPEWRITER THREADS" title="Storylines / 剧本线索" />,
    pitch: <PitchDesk />,
    library: <LocalLibrary />,
  }[page];

  return (
    <AppShell page={page} onNavigate={setPage} query={query} onQueryChange={setQuery}>
      {content}
    </AppShell>
  );
}

import type { PageKey } from '../../data';
import type { AssetBundle, UploadedFileRecord } from '../../utils/api';
import { getCompleteness } from '../../utils/completeness';

export function ArchiveIntakeBoard({ assets, files, onSelectPage }: { assets: AssetBundle; files: UploadedFileRecord[]; onSelectPage: (page: PageKey) => void }) {
  const dossiers = [...assets.factions, ...assets.districts, ...assets.pois, ...assets.characters, ...assets.storylines];
  const incomplete = dossiers.filter((asset) => getCompleteness(asset, files).status === 'incomplete').length;
  const underReview = dossiers.filter((asset) => asset.status === 'under_review' || getCompleteness(asset, files).status === 'needs_review').length;
  const secret = dossiers.filter((asset) => asset.spoilerLevel === 'secret').length;
  const unlinked = files.filter((file) => !file.linkedAssetIds?.length).length;
  const missingSource = dossiers.filter((asset) => !asset.sourceNotes.length).length;
  const charactersNoStory = assets.characters.filter((asset) => !asset.relatedStorylineIds.length).length;
  const factionsNoTerritory = assets.factions.filter((asset) => !asset.territoryDistrictIds.length).length;
  const storylinesNoCharacters = assets.storylines.filter((asset) => !asset.relatedCharacterIds.length).length;
  const stats: Array<[string, number, PageKey]> = [
    ['Total dossiers', dossiers.length, 'dashboard'], ['Factions count', assets.factions.length, 'factions'], ['Districts count', assets.districts.length, 'districts'], ['POI count', assets.pois.length, 'districts'], ['Characters count', assets.characters.length, 'characters'], ['Storylines count', assets.storylines.length, 'storylines'], ['Incomplete dossiers', incomplete, 'dashboard'], ['Under review dossiers', underReview, 'dashboard'], ['Secret dossiers', secret, 'dashboard'], ['Unlinked evidence files', unlinked, 'library'],
  ];
  const actions = [
    `${unlinked} evidence files are unlinked.`, `${missingSource} dossiers are missing source notes.`, `${charactersNoStory} characters have no related storyline.`, `${factionsNoTerritory} factions have no territory district.`, `${storylinesNoCharacters} storylines have no related characters.`,
  ];
  return (
    <section className="border border-brass/30 bg-[linear-gradient(120deg,rgba(34,25,20,.92),rgba(77,45,27,.72))] p-5 shadow-dossier">
      <p className="type-label text-crimson">ARCHIVE INTAKE BOARD / 资料接收进度板</p>
      <h3 className="font-display text-3xl text-ivory">Case Wall Worklist</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {stats.map(([label, value, page]) => <button key={label} onClick={() => onSelectPage(page)} className="border border-brass/25 bg-paper/90 p-3 text-left transition hover:-translate-y-1"><p className="font-display text-3xl text-crimson">{value}</p><p className="type-label text-walnut/65">{label}</p></button>)}
      </div>
      <div className="mt-5 border-l-4 border-brass bg-paper/90 p-4">
        <p className="section-title">Next Recommended Actions</p>
        <ul className="mt-3 grid gap-2 font-mono text-xs text-espresso/80">{actions.map((action) => <li key={action} className="border-b border-walnut/10 pb-2">□ {action}</li>)}</ul>
      </div>
    </section>
  );
}

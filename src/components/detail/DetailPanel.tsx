import type { AnyAsset } from '../../data';
import type { AssetBundle, UploadedFileRecord } from '../../utils/api';
import { assetTypeFor, linkedFilesForAsset, makeAssetIndex } from '../../utils/assetHelpers';
import { ClassifiedBadge } from '../ui/ClassifiedBadge';
import { StatusStamp } from '../ui/StatusStamp';
import { LinkedFileList } from './LinkedFileList';
import { RelatedAssetList } from './RelatedAssetList';

const relationKeys = ['relatedFactionIds', 'relatedDistrictIds', 'relatedPoiIds', 'relatedCharacterIds', 'relatedStorylineIds'] as const;

function getExtraRows(asset: AnyAsset): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const add = (label: string, value: unknown) => {
    const rendered = Array.isArray(value) ? value.join(' / ') : String(value ?? '');
    if (rendered) rows.push([label, rendered]);
  };
  if ('characterType' in asset) { add('Type', asset.characterType); add('Occupation', asset.occupation); add('Weapon', asset.weapon); add('Arc', asset.characterArc); add('Timeline Status', asset.currentTimelineStatus); }
  if ('factionCategory' in asset) { add('Category', asset.factionCategory); add('Cultural Root', asset.culturalRoot); add('Business', asset.coreBusiness); add('Mission Types', asset.missionTypes); }
  if ('poiTier' in asset) { add('POI Tier', asset.poiTier); add('Address Ref', asset.addressReference); add('Gameplay', asset.gameplayUsage); add('Story Usage', asset.storyUsage); }
  if ('atmosphere' in asset) { add('Atmosphere', asset.atmosphere); add('Real Ref', asset.realWorldReference); add('Gameplay Usage', asset.gameplayUsage); add('Story Usage', asset.storyUsage); }
  if ('storylineType' in asset) { add('Storyline Type', asset.storylineType); add('Timeline', asset.timeline ?? asset.timelinePlacement); add('Act', asset.act); add('Main Conflict', asset.mainConflict); add('Player Goal', asset.playerGoal); add('Pitch Status', asset.pitchStatus); }
  return rows;
}

export function DetailPanel({ asset, bundle, files = [], onOpenRelated, onEdit, onDelete, readOnly }: { asset?: AnyAsset; bundle: AssetBundle; files?: UploadedFileRecord[]; onOpenRelated?: (asset: AnyAsset) => void; onEdit?: (asset: AnyAsset) => void; onDelete?: (asset: AnyAsset) => void; readOnly?: boolean }) {
  if (!asset) return <aside className="dossier-panel p-6 text-paper/70">Select a case card to open the dossier folder.</aside>;
  const index = makeAssetIndex(bundle);
  const related = relationKeys.flatMap((key) => asset[key].map((id) => index.get(id))).filter(Boolean) as Array<{ asset: AnyAsset; type: ReturnType<typeof assetTypeFor> }>;
  const linked = linkedFilesForAsset(files, asset.id);

  return (
    <aside className="dossier-panel p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-brass/30 pb-4">
        <div>
          <p className="type-label text-crimson">OPEN DOSSIER · {asset.id}</p>
          <h2 className="font-display text-3xl text-espresso">{asset.name}</h2>
          <p className="text-walnut/70">{asset.chineseName} · {asset.englishName}</p>
          {asset.spoilerLevel === 'secret' ? <p className="mt-2 inline-block -rotate-2 border-2 border-crimson px-3 py-1 font-mono text-xl font-black uppercase tracking-[0.25em] text-crimson">CLASSIFIED</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <StatusStamp status={asset.status} />
          <ClassifiedBadge level={asset.spoilerLevel} />
          <button className="stamp border-brass text-brass disabled:cursor-not-allowed disabled:opacity-45" disabled={readOnly} title={readOnly ? 'Local API offline. Archive is read-only.' : undefined} onClick={() => onEdit?.(asset)}>EDIT</button>
          <button className="stamp border-crimson text-crimson disabled:cursor-not-allowed disabled:opacity-45" disabled={readOnly} title={readOnly ? 'Local API offline. Archive is read-only.' : undefined} onClick={() => onDelete?.(asset)}>DELETE</button>
        </div>
      </div>
      <section><h3 className="section-title">Summary</h3><p className="mt-2 leading-7 text-espresso/85">{asset.summary}</p></section>
      <section className="mt-5"><h3 className="section-title">Details</h3><p className="mt-2 whitespace-pre-wrap leading-7 text-espresso/85">{asset.details}</p></section>
      <section className="mt-5 flex flex-wrap gap-2">{asset.tags.map((tag) => <span key={tag} className="tag-label">{tag}</span>)}{asset.aliases.map((alias) => <span key={alias} className="tag-label border-walnut/30 text-walnut/70">AKA {alias}</span>)}</section>
      <section className="mt-6 grid gap-3">{getExtraRows(asset).map(([label, value]) => <div key={label} className="border-l-2 border-brass/50 pl-3"><p className="type-label text-walnut/55">{label}</p><p className="text-sm text-espresso/80">{value}</p></div>)}</section>
      {asset.narrativeConstraints.length ? <section className="mt-6"><h3 className="section-title">Narrative Constraints</h3><ul className="mt-2 space-y-2">{asset.narrativeConstraints.map((item) => <li key={item} className="warning-strip">⚠ {item}</li>)}</ul></section> : null}
      {asset.doNotRevealYet.length ? <section className="mt-6 border border-crimson/50 bg-crimson/10 p-3"><h3 className="section-title text-crimson">Do Not Reveal Yet</h3><ul className="mt-2 list-disc pl-5 text-sm text-espresso/80">{asset.doNotRevealYet.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
      <section className="mt-6"><h3 className="section-title">Related Dossiers</h3><div className="mt-2"><RelatedAssetList related={related} onOpen={onOpenRelated} /></div></section>
      <section className="mt-6"><h3 className="section-title">Source Notes</h3><ul className="mt-2 list-disc pl-5 text-sm text-espresso/75">{asset.sourceNotes.length ? asset.sourceNotes.map((note) => <li key={note}>{note}</li>) : <li>No source notes.</li>}</ul></section>
      <section className="mt-6"><h3 className="section-title">Linked Files / Evidence</h3><div className="mt-2"><LinkedFileList files={linked} /></div></section>
    </aside>
  );
}

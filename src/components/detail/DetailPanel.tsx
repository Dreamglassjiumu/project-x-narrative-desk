import type { AnyAsset } from '../../data';
import { assetById } from '../../data';
import { ClassifiedBadge } from '../ui/ClassifiedBadge';
import { StatusStamp } from '../ui/StatusStamp';

const relationKeys: Array<keyof Pick<AnyAsset, 'relatedFactionIds' | 'relatedDistrictIds' | 'relatedPoiIds' | 'relatedCharacterIds' | 'relatedStorylineIds'>> = [
  'relatedFactionIds',
  'relatedDistrictIds',
  'relatedPoiIds',
  'relatedCharacterIds',
  'relatedStorylineIds',
];

function getExtraRows(asset: AnyAsset): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if ('characterType' in asset) {
    rows.push(['Type', asset.characterType], ['Occupation', asset.occupation], ['Weapon', asset.weapon], ['Arc', asset.characterArc]);
  }
  if ('factionCategory' in asset) {
    rows.push(['Category', asset.factionCategory], ['Cultural Root', asset.culturalRoot], ['Business', asset.coreBusiness.join(' / ')], ['Mission Types', asset.missionTypes.join(' / ')]);
  }
  if ('poiTier' in asset) {
    rows.push(['POI Tier', asset.poiTier], ['Address Ref', asset.addressReference], ['Gameplay', asset.gameplayUsage.join(' / ')], ['Story Usage', asset.storyUsage.join(' / ')]);
  }
  if ('atmosphere' in asset) {
    rows.push(['Atmosphere', asset.atmosphere.join(' / ')], ['Real Ref', asset.realWorldReference]);
  }
  if ('storylineType' in asset) {
    rows.push(['Storyline Type', asset.storylineType], ['Timeline', asset.timeline], ['Act', asset.act]);
  }
  return rows;
}

export function DetailPanel({ asset }: { asset?: AnyAsset }) {
  if (!asset) {
    return <aside className="dossier-panel p-6 text-paper/70">Select a case card to open the dossier folder.</aside>;
  }

  const related = relationKeys.flatMap((key) => asset[key].map((id) => assetById.get(id))).filter(Boolean) as AnyAsset[];

  return (
    <aside className="dossier-panel p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-brass/30 pb-4">
        <div>
          <p className="type-label text-crimson">OPEN DOSSIER · {asset.id}</p>
          <h2 className="font-display text-3xl text-espresso">{asset.name}</h2>
          <p className="text-walnut/70">{asset.chineseName} · {asset.englishName}</p>
        </div>
        <div className="flex flex-col gap-2">
          <StatusStamp status={asset.status} />
          <ClassifiedBadge level={asset.spoilerLevel} />
        </div>
      </div>
      <p className="leading-7 text-espresso/85">{asset.details}</p>
      <section className="mt-6 grid gap-3">
        {getExtraRows(asset).map(([label, value]) => (
          <div key={label} className="border-l-2 border-brass/50 pl-3">
            <p className="type-label text-walnut/55">{label}</p>
            <p className="text-sm text-espresso/80">{value}</p>
          </div>
        ))}
      </section>
      <section className="mt-6">
        <h3 className="section-title">Narrative Constraints</h3>
        <ul className="mt-2 space-y-2">
          {asset.narrativeConstraints.map((item) => <li key={item} className="warning-strip">{item}</li>)}
        </ul>
      </section>
      {asset.doNotRevealYet.length > 0 && (
        <section className="mt-6 border border-crimson/50 bg-crimson/10 p-3">
          <h3 className="section-title text-crimson">Do Not Reveal Yet</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-espresso/80">
            {asset.doNotRevealYet.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      )}
      <section className="mt-6">
        <h3 className="section-title">Linked Files</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {related.length ? related.map((item) => <span key={item.id} className="tag-label">{item.name}</span>) : <span className="text-sm text-walnut/60">No linked records.</span>}
        </div>
      </section>
    </aside>
  );
}

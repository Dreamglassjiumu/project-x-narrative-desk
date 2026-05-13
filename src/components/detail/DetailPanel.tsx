import type { AnyAsset } from '../../data';
import type { AssetBundle, UploadedFileRecord } from '../../utils/api';
import { flattenAssets } from '../../utils/api';
import type { ArchiveNotifier } from '../ui/ArchiveNotice';
import { assetTypeFor, linkedFilesForAsset, makeAssetIndex } from '../../utils/assetHelpers';
import { getCompleteness } from '../../utils/completeness';
import { CompletenessBadge } from '../intake/CompletenessBadge';
import { MissingFieldsList } from '../intake/MissingFieldsList';
import { ClassifiedBadge } from '../ui/ClassifiedBadge';
import { StatusStamp } from '../ui/StatusStamp';
import { LinkedFileList } from './LinkedFileList';
import { PrimaryEvidenceSlot } from '../evidence/PrimaryEvidenceSlot';
import { RelatedAssetList } from './RelatedAssetList';
import { characterTypeLabel, pitchStatusLabel, zh } from '../../i18n/zhCN';

const relationKeys = ['relatedFactionIds', 'relatedDistrictIds', 'relatedPoiIds', 'relatedCharacterIds', 'relatedStorylineIds'] as const;

function getExtraRows(asset: AnyAsset): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const add = (label: string, value: unknown) => {
    const rendered = Array.isArray(value) ? value.join(' / ') : String(value ?? '');
    if (rendered) rows.push([label, rendered]);
  };
  if ('characterType' in asset) { add('类型', characterTypeLabel(asset.characterType)); add('职业', asset.occupation); add('武器', asset.weapon); add('角色弧光', asset.characterArc); add('时间线状态', asset.currentTimelineStatus); }
  if ('factionCategory' in asset) { add('类别', asset.factionCategory); add('文化根源', asset.culturalRoot); add('业务', asset.coreBusiness); add('任务类型', asset.missionTypes); }
  if ('poiTier' in asset) { add('地点等级', asset.poiTier); add('地址参考', asset.addressReference); add('玩法', asset.gameplayUsage); add('剧情用途', asset.storyUsage); }
  if ('atmosphere' in asset) { add('氛围', asset.atmosphere); add('现实参考', asset.realWorldReference); add('玩法用途', asset.gameplayUsage); add('剧情用途', asset.storyUsage); }
  if ('designAssetType' in asset) { add('设计资料类型', asset.designAssetType); add('视觉关键词', asset.visualKeywords); }
  if ('storylineType' in asset) { add('剧情线类型', asset.storylineType); add('时间线', asset.timeline ?? asset.timelinePlacement); add('幕', asset.act); add('主要冲突', asset.mainConflict); add('玩家目标', asset.playerGoal); add('Pitch 状态', pitchStatusLabel(asset.pitchStatus)); }
  return rows;
}

export function DetailPanel({ asset, bundle, files = [], onOpenRelated, onEdit, onDelete, onMerge, readOnly, onAssetSaved, onFilesChanged, notify }: { asset?: AnyAsset; bundle: AssetBundle; files?: UploadedFileRecord[]; onOpenRelated?: (asset: AnyAsset) => void; onEdit?: (asset: AnyAsset) => void; onDelete?: (asset: AnyAsset) => void; onMerge?: (asset: AnyAsset) => void; readOnly?: boolean; onAssetSaved?: (asset: AnyAsset) => void; onFilesChanged?: (files: UploadedFileRecord[]) => void; notify?: ArchiveNotifier }) {
  if (!asset) return <aside className="dossier-panel p-6 text-paper/70">请选择一个档案卡片以打开档案。</aside>;
  const index = makeAssetIndex(bundle);
  const related = relationKeys.flatMap((key) => asset[key].map((id) => index.get(id))).filter(Boolean) as Array<{ asset: AnyAsset; type: ReturnType<typeof assetTypeFor> }>;
  const linked = linkedFilesForAsset(files, asset.id);
  const completeness = getCompleteness(asset, files);

  return (
    <aside className="dossier-panel p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-brass/30 pb-4">
        <div>
          <p className="type-label text-crimson">档案详情 · {asset.id}</p>
          <h2 className="font-display text-3xl text-espresso">{asset.name}</h2>
          <p className="text-walnut/70">{asset.chineseName} · {asset.englishName}</p>
          {asset.spoilerLevel === 'secret' ? <p className="mt-2 inline-block -rotate-2 border-2 border-crimson px-3 py-1 font-mono text-xl font-black uppercase tracking-[0.25em] text-crimson">CLASSIFIED</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <CompletenessBadge result={completeness} />
          <StatusStamp status={asset.status} />
          <ClassifiedBadge level={asset.spoilerLevel} />
          <button className="stamp border-brass text-brass disabled:cursor-not-allowed disabled:opacity-45" disabled={readOnly} title={readOnly ? '本地接口离线，当前为只读模式。' : undefined} onClick={() => onEdit?.(asset)}>编辑</button>
          <button className="stamp border-brass text-brass disabled:cursor-not-allowed disabled:opacity-45" disabled={readOnly} title={readOnly ? '本地接口离线，当前为只读模式。' : undefined} onClick={() => onMerge?.(asset)}>合并到其他档案</button><button className="stamp border-crimson text-crimson disabled:cursor-not-allowed disabled:opacity-45" disabled={readOnly} title={readOnly ? '本地接口离线，当前为只读模式。' : undefined} onClick={() => onDelete?.(asset)}>删除</button>
        </div>
      </div>
      <PrimaryEvidenceSlot asset={asset} bundle={bundle} files={files} readOnly={readOnly} onAssetSaved={onAssetSaved} onFilesChanged={onFilesChanged} notify={notify} />
      <section className="mb-5"><MissingFieldsList result={completeness} /></section>
      <section><h3 className="section-title">简介</h3><p className="mt-2 leading-7 text-espresso/85">{asset.summary}</p></section>
      <section className="mt-5"><h3 className="section-title">详情</h3><p className="mt-2 whitespace-pre-wrap leading-7 text-espresso/85">{asset.details}</p></section>
      <section className="mt-5 flex flex-wrap gap-2">{asset.tags.map((tag) => <span key={tag} className="tag-label">{tag}</span>)}{asset.aliases.map((alias) => <span key={alias} className="tag-label border-walnut/30 text-walnut/70">AKA {alias}</span>)}</section>
      <section className="mt-6 grid gap-3">{getExtraRows(asset).map(([label, value]) => <div key={label} className="border-l-2 border-brass/50 pl-3"><p className="type-label text-walnut/55">{label}</p><p className="text-sm text-espresso/80">{value}</p></div>)}</section>
      {asset.narrativeConstraints.length ? <section className="mt-6"><h3 className="section-title">叙事限制</h3><ul className="mt-2 space-y-2">{asset.narrativeConstraints.map((item) => <li key={item} className="warning-strip">⚠ {item}</li>)}</ul></section> : null}
      {asset.doNotRevealYet.length ? <section className="mt-6 border border-crimson/50 bg-crimson/10 p-3"><h3 className="section-title text-crimson">暂不公开</h3><ul className="mt-2 list-disc pl-5 text-sm text-espresso/80">{asset.doNotRevealYet.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
      <section className="mt-6"><h3 className="section-title">关联档案</h3><div className="mt-2"><RelatedAssetList related={related} onOpen={onOpenRelated} /></div></section>
      <section className="mt-6"><h3 className="section-title">来源备注</h3><ul className="mt-2 list-disc pl-5 text-sm text-espresso/75">{asset.sourceNotes.length ? asset.sourceNotes.map((note) => <li key={note}>{note}</li>) : <li>暂无来源备注。</li>}</ul></section>
      <section className="mt-6"><h3 className="section-title">关联证物</h3><div className="mt-2"><LinkedFileList files={linked} assets={flattenAssets(bundle)} /></div></section>
    </aside>
  );
}

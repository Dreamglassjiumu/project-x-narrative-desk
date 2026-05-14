import { useEffect, useMemo, useRef } from 'react';
import type { AnyAsset, Character, District, Faction, Poi, Storyline } from '../../data';
import { assetTypeFor, type AssetType } from '../../utils/assetHelpers';
import { categoryLabelZh, spoilerLabel, statusLabel } from '../../i18n/zhCN';
import { ClassifiedBadge } from '../ui/ClassifiedBadge';
import { StatusStamp } from '../ui/StatusStamp';

type DossierDetailModalProps = {
  asset: AnyAsset;
  allAssets: AnyAsset[];
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onInsertName: (asset: AnyAsset) => void;
  onInsertReference: (asset: AnyAsset) => void;
  onAddToLinks: (asset: AnyAsset) => void;
};

type DetailSection = {
  title: string;
  rows: Array<[string, unknown]>;
};

const relationLabels: Record<string, string> = {
  relatedFactionIds: '关联帮派',
  relatedDistrictIds: '关联区域',
  relatedPoiIds: '关联地点',
  relatedCharacterIds: '关联角色',
  relatedStorylineIds: '关联剧情',
};

const detailTypeLabels: Record<AssetType, string> = {
  characters: '人物档案',
  factions: '帮派档案',
  districts: '区域档案',
  pois: '地点档案',
  storylines: '剧情线档案',
  'design-assets': '设计资料',
};

const valueToText = (value: unknown, index: Map<string, AnyAsset>): string => {
  if (Array.isArray(value)) return value.map((item) => valueToText(item, index)).filter(Boolean).join(' / ');
  if (typeof value === 'string') return index.get(value)?.name ?? value;
  if (value === undefined || value === null) return '';
  return String(value);
};

const isPresent = (value: unknown, index: Map<string, AnyAsset>) => valueToText(value, index).trim().length > 0;

const makeRows = (rows: Array<[string, unknown]>, index: Map<string, AnyAsset>) => rows.filter(([, value]) => isPresent(value, index));

const pageForAsset = (asset: AnyAsset): AssetType => {
  const type = assetTypeFor(asset);
  return type === 'pois' ? 'districts' : type;
};

const primaryName = (asset: AnyAsset) => asset.name || asset.chineseName || asset.englishName || asset.id;

const sectionsForAsset = (asset: AnyAsset, index: Map<string, AnyAsset>): DetailSection[] => {
  const base: DetailSection[] = [
    {
      title: '基本信息',
      rows: makeRows([
        ['ID', asset.id],
        ['名称', asset.name],
        ['中文名', asset.chineseName],
        ['英文名', asset.englishName],
        ['别名', asset.aliases],
        ['状态', statusLabel(asset.status)],
        ['保密等级', spoilerLabel(asset.spoilerLevel)],
      ], index),
    },
  ];

  if ('characterType' in asset) {
    const character = asset as Character;
    base[0].rows.push(...makeRows([
      ['职业', character.occupation],
      ['年龄', character.age],
      ['性别', character.gender],
      ['所属帮派', character.factionId],
      ['所属区域', character.districtId],
      ['角色类型', character.characterType],
      ['时间线状态', character.currentTimelineStatus],
    ], index));
  }

  if ('factionCategory' in asset) {
    const faction = asset as Faction;
    base[0].rows.push(...makeRows([
      ['类别', faction.factionCategory],
      ['文化根源', faction.culturalRoot],
      ['地盘 / 相关区域', faction.territoryDistrictIds],
      ['总部地点', faction.headquartersPoiIds],
    ], index));
    base.push({ title: '势力关系', rows: makeRows([['盟友', faction.allies], ['敌人', faction.enemies], ['核心业务', faction.coreBusiness], ['任务类型', faction.missionTypes]], index) });
  }

  if ('atmosphere' in asset && !('poiTier' in asset)) {
    const district = asset as District;
    base[0].rows.push(...makeRows([
      ['区域类型', district.districtType],
      ['氛围', district.atmosphere],
      ['主导势力', district.dominantFactions],
      ['重要地点', district.keyPoiIds],
      ['区域状态', district.districtStatus],
    ], index));
  }

  if ('poiTier' in asset) {
    const poi = asset as Poi;
    base[0].rows.push(...makeRows([
      ['所属区域', poi.districtId],
      ['地点类型', poi.poiType],
      ['地点等级', poi.poiTier],
      ['功能 / 用途', poi.function],
      ['控制者 / 经营者', poi.owner],
      ['地址参考', poi.addressReference],
      ['位置', poi.location],
    ], index));
  }

  if ('storylineType' in asset) {
    const storyline = asset as Storyline;
    base[0].rows.push(...makeRows([
      ['剧情线类型', storyline.storylineType],
      ['幕', storyline.act],
      ['时间线', storyline.timeline ?? storyline.timelinePlacement],
      ['主要冲突', storyline.mainConflict],
      ['玩家目标', storyline.playerGoal],
      ['结局状态', storyline.endingState],
      ['Pitch 状态', storyline.pitchStatus],
    ], index));
  }

  base.push(
    { title: '简介', rows: makeRows([['Summary', asset.summary]], index) },
    { title: '详细设定', rows: makeRows([['Details', asset.details]], index) },
    {
      title: '关联档案',
      rows: makeRows([
        [relationLabels.relatedCharacterIds, asset.relatedCharacterIds],
        [relationLabels.relatedFactionIds, asset.relatedFactionIds],
        [relationLabels.relatedDistrictIds, asset.relatedDistrictIds],
        [relationLabels.relatedPoiIds, asset.relatedPoiIds],
        [relationLabels.relatedStorylineIds, asset.relatedStorylineIds],
      ], index),
    },
    { title: '标签与备注', rows: makeRows([['标签', asset.tags], ['叙事限制', asset.narrativeConstraints], ['暂不公开', asset.doNotRevealYet], ['来源 / 备注', asset.sourceNotes]], index) },
  );

  return base.filter((section) => section.rows.length > 0);
};

export function DossierDetailModal({ asset, allAssets, hasPrevious, hasNext, onPrevious, onNext, onClose, onInsertName, onInsertReference, onAddToLinks }: DossierDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const assetIndex = useMemo(() => new Map(allAssets.map((item) => [item.id, item])), [allAssets]);
  const sections = useMemo(() => sectionsForAsset(asset, assetIndex), [asset, assetIndex]);
  const type = assetTypeFor(asset);
  const typeLabel = detailTypeLabels[type] ?? categoryLabelZh(asset.category);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus();
    };
  }, [onClose]);

  const openFullDossier = () => {
    window.dispatchEvent(new CustomEvent('projectx:open-dossier', { detail: { view: pageForAsset(asset), assetId: asset.id } }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-detail-title"
        className="flex max-h-[85vh] w-[min(94vw,920px)] flex-col overflow-hidden border border-brass/60 bg-paper text-espresso shadow-noir outline-none transition duration-150"
      >
        <header className="sticky top-0 z-[2] shrink-0 border-b border-brass/35 bg-[#d8c09a]/95 p-4 shadow-card backdrop-blur md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="type-label text-crimson">{typeLabel} · {asset.id}</p>
              <h2 id="dossier-detail-title" className="mt-1 break-words font-display text-3xl text-espresso">{primaryName(asset)}</h2>
              <p className="mt-1 text-sm text-walnut/70">{asset.chineseName || '暂无中文名'} · {asset.englishName || '暂无英文名'}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <button type="button" className="stamp border-brass text-walnut disabled:opacity-35" disabled={!hasPrevious} onClick={onPrevious}>上一个</button>
              <button type="button" className="stamp border-brass text-walnut disabled:opacity-35" disabled={!hasNext} onClick={onNext}>下一个</button>
              <button ref={closeRef} type="button" className="relative z-[5] border-2 border-crimson bg-espresso px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-paper shadow-[0_0_20px_rgba(139,31,36,0.45)] transition hover:bg-crimson focus:outline-none focus:ring-2 focus:ring-brass" onClick={onClose}>× 关闭</button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusStamp status={asset.status} />
            <ClassifiedBadge level={asset.spoilerLevel} />
            {asset.tags.slice(0, 6).map((tag) => <span key={tag} className="tag-label bg-walnut/10">{tag}</span>)}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
          <div className="grid gap-4">
            {sections.map((section) => (
              <section key={section.title} className="border border-walnut/20 bg-[#ead8b8]/55 p-4 shadow-card">
                <h3 className="section-title border-b border-walnut/20 pb-2">{section.title}</h3>
                <dl className="mt-3 grid gap-3 md:grid-cols-2">
                  {section.rows.map(([label, value]) => (
                    <div key={`${section.title}-${label}`} className={(label === 'Summary' || label === 'Details' || label.includes('备注')) ? 'md:col-span-2' : ''}>
                      <dt className="field-label">{label}</dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-espresso/85">{valueToText(value, assetIndex) || '暂无'}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </main>

        <footer className="shrink-0 border-t border-brass/35 bg-[#d8c09a]/95 p-4 shadow-[0_-12px_24px_rgba(33,19,15,0.16)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-walnut/60">Esc / 点击遮罩 / 右上角均可关闭，内容区可滚动。</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="stamp border-walnut text-walnut" onClick={() => onInsertName(asset)}>插入名称</button>
              <button type="button" className="stamp border-brass bg-brass/10 text-walnut" onClick={() => onInsertReference(asset)}>插入引用片段</button>
              <button type="button" className="stamp border-brass text-brass" onClick={() => onAddToLinks(asset)}>添加到关联档案</button>
              <button type="button" className="stamp border-crimson text-crimson" onClick={openFullDossier}>查看完整档案</button>
              <button type="button" className="stamp border-walnut text-walnut" onClick={onClose}>关闭</button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

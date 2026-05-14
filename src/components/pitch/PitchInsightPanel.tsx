import { useState } from 'react';
import type { AnyAsset } from '../../data';
import type { PitchDraft } from '../../utils/pitch';
import { categoryLabelZh, spoilerLabel, statusLabel } from '../../i18n/zhCN';
import { ClassifiedBadge } from '../ui/ClassifiedBadge';
import { StatusStamp } from '../ui/StatusStamp';
import { DossierDetailModal } from './DossierDetailModal';

type SaveStatus = 'autosaved' | 'unsaved' | 'saved' | 'offline';

const groupByCategory = (assets: AnyAsset[], category: string) => assets.filter((asset) => asset.category === category);

const AssetPillList = ({ title, assets }: { title: string; assets: AnyAsset[] }) => (
  <div>
    <p className="field-label text-paper/55">{title}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      {assets.length ? assets.map((asset) => <span key={asset.id} className="tag-label border-brass/40 bg-paper/10 text-paper/80">{asset.name}</span>) : <span className="text-sm text-paper/45">暂无关联。</span>}
    </div>
  </div>
);

const statusCopy: Record<SaveStatus, string> = {
  autosaved: '已自动保存到浏览器草稿',
  unsaved: '有未保存修改',
  saved: '已保存到本地档案',
  offline: '本地接口离线 / 只读',
};

function AutoLinkCard({ asset, index, onOpen }: { asset: AnyAsset; index: number; onOpen: (index: number) => void }) {
  return (
    <button
      type="button"
      className="group min-h-[148px] w-full cursor-pointer border border-brass/25 bg-paper/95 p-3 text-left text-espresso shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-crimson/65 hover:bg-[#ead8b8] hover:shadow-dossier focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-espresso active:translate-y-0"
      onClick={() => onOpen(index)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onOpen(index);
        }
      }}
      aria-label={`打开自动识别档案详情：${asset.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="type-label truncate text-crimson">{categoryLabelZh(asset.category)} · {asset.id}</p>
          <h3 className="mt-1 truncate font-display text-lg text-espresso">{asset.name}</h3>
        </div>
        <ClassifiedBadge level={asset.spoilerLevel} />
      </div>
      <p className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-espresso/75">{asset.summary || asset.details || '暂无摘要。'}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-walnut/15 pt-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-walnut/60">{statusLabel(asset.status)} · {spoilerLabel(asset.spoilerLevel)}</span>
        <span className="stamp border-crimson/55 text-crimson transition group-hover:bg-crimson group-hover:text-paper">点击查看详情</span>
      </div>
    </button>
  );
}

export function PitchInsightPanel({ draft, manualLinks, detected, riskAssets, saveStatus, allAssets, onInsertName, onInsertReference, onAddToLinks }: {
  draft: PitchDraft;
  manualLinks: AnyAsset[];
  detected: AnyAsset[];
  riskAssets: AnyAsset[];
  saveStatus: SaveStatus;
  allAssets: AnyAsset[];
  onInsertName: (asset: AnyAsset) => void;
  onInsertReference: (asset: AnyAsset) => void;
  onAddToLinks: (asset: AnyAsset) => void;
}) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>();
  const activeAsset = activeIndex === undefined ? undefined : detected[activeIndex];

  return (
    <aside className="max-h-[calc(100vh-7rem)] overflow-y-auto border border-crimson/40 bg-espresso/80 p-4 shadow-dossier 2xl:sticky 2xl:top-24">
      <p className="type-label text-crimson">PITCH MEMO</p>
      <h2 className="font-display text-2xl text-ivory">关联与提醒</h2>
      <p className="mt-2 text-sm text-paper/65">关联档案与风险提醒。</p>

      <section className="mt-4 border border-brass/25 bg-walnut/35 p-3">
        <p className="type-label text-brass">保存状态</p>
        <p className={`mt-2 font-mono text-sm ${saveStatus === 'offline' ? 'text-crimson' : saveStatus === 'saved' ? 'text-teal' : 'text-paper'}`}>{statusCopy[saveStatus]}</p>
        <p className="mt-1 text-xs text-paper/45">草稿 ID： {draft.id ?? '尚未入库'}</p>
      </section>

      <section className="mt-4 space-y-3 border border-brass/25 bg-black/10 p-3">
        <p className="type-label text-brass">手动关联</p>
        <AssetPillList title="角色" assets={groupByCategory(manualLinks, 'Character')} />
        <AssetPillList title="帮派" assets={groupByCategory(manualLinks, 'Faction')} />
        <AssetPillList title="区域" assets={groupByCategory(manualLinks, 'District')} />
        <AssetPillList title="地点" assets={groupByCategory(manualLinks, 'POI')} />
        <AssetPillList title="剧情线" assets={groupByCategory(manualLinks, 'Storyline')} />
      </section>

      <section className="mt-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="type-label text-brass">自动识别</p>
            <p className="mt-1 text-xs text-paper/50">列表仅显示摘要，点击卡片在浮层中阅读完整资料。</p>
          </div>
          <span className="stamp border-brass/60 text-brass">{detected.length} 条</span>
        </div>
        <div className="mt-3 max-h-[48vh] space-y-3 overflow-y-auto pr-1">
          {detected.length === 0 && <div className="border border-dashed border-brass/30 p-3 text-sm text-paper/60">暂无自动识别结果。</div>}
          {detected.map((asset, index) => <AutoLinkCard key={asset.id} asset={asset} index={index} onOpen={setActiveIndex} />)}
        </div>
      </section>

      <section className="mt-4 border border-crimson/35 bg-crimson/10 p-3">
        <p className="type-label text-crimson">风险提醒</p>
        <div className="mt-3 space-y-3">
          {riskAssets.every((asset) => asset.narrativeConstraints.length === 0 && asset.doNotRevealYet.length === 0) ? <p className="text-sm text-paper/60">关联或识别到的档案中没有叙事限制或暂不公开内容。</p> : null}
          {riskAssets.map((asset) => (asset.narrativeConstraints.length || asset.doNotRevealYet.length) ? (
            <article key={asset.id} className="border-l-4 border-brass bg-paper/95 p-3 text-espresso">
              <p className="font-display text-lg">{asset.name}</p>
              {asset.narrativeConstraints.length > 0 && <ul className="mt-2 space-y-1 text-sm">{asset.narrativeConstraints.map((item) => <li key={item}>限制： {item}</li>)}</ul>}
              {asset.doNotRevealYet.length > 0 && <p className="mt-2 bg-crimson/10 p-2 text-sm text-crimson">暂不公开： {asset.doNotRevealYet.join(' / ')}</p>}
            </article>
          ) : null)}
        </div>
      </section>

      {activeAsset ? (
        <DossierDetailModal
          asset={activeAsset}
          allAssets={allAssets}
          hasPrevious={Boolean(activeIndex && activeIndex > 0)}
          hasNext={activeIndex !== undefined && activeIndex < detected.length - 1}
          onPrevious={() => setActiveIndex((current) => current === undefined ? current : Math.max(0, current - 1))}
          onNext={() => setActiveIndex((current) => current === undefined ? current : Math.min(detected.length - 1, current + 1))}
          onClose={() => setActiveIndex(undefined)}
          onInsertName={onInsertName}
          onInsertReference={onInsertReference}
          onAddToLinks={onAddToLinks}
        />
      ) : null}
    </aside>
  );
}

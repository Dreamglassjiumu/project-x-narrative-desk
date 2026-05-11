import type { AnyAsset } from '../../data';
import type { PitchDraft } from '../../utils/pitch';
import { ClassifiedBadge } from '../ui/ClassifiedBadge';

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

export function PitchInsightPanel({ draft, manualLinks, detected, riskAssets, saveStatus }: { draft: PitchDraft; manualLinks: AnyAsset[]; detected: AnyAsset[]; riskAssets: AnyAsset[]; saveStatus: SaveStatus }) {
  return (
    <aside className="border border-crimson/40 bg-espresso/80 p-4 shadow-dossier">
      <p className="type-label text-crimson">PITCH INTELLIGENCE / RED STRING MEMO</p>
      <h2 className="font-display text-2xl text-ivory">关联与提醒</h2>
      <p className="mt-2 text-sm text-paper/65">扫描 Pitch Title + Pitch Body，并汇总手动关联资料中的限制。</p>

      <section className="mt-4 border border-brass/25 bg-walnut/35 p-3">
        <p className="type-label text-brass">保存状态</p>
        <p className={`mt-2 font-mono text-sm ${saveStatus === 'offline' ? 'text-crimson' : saveStatus === 'saved' ? 'text-teal' : 'text-paper'}`}>{statusCopy[saveStatus]}</p>
        <p className="mt-1 text-xs text-paper/45">草稿 ID： {draft.id ?? '尚未入库'}</p>
      </section>

      <section className="mt-4 space-y-3 border border-brass/25 bg-black/10 p-3">
        <p className="type-label text-brass">Manual Links / 手动关联</p>
        <AssetPillList title="角色" assets={groupByCategory(manualLinks, 'Character')} />
        <AssetPillList title="帮派" assets={groupByCategory(manualLinks, 'Faction')} />
        <AssetPillList title="区域" assets={groupByCategory(manualLinks, 'District')} />
        <AssetPillList title="地点" assets={groupByCategory(manualLinks, 'POI')} />
        <AssetPillList title="剧情线" assets={groupByCategory(manualLinks, 'Storyline')} />
      </section>

      <section className="mt-4">
        <p className="type-label text-brass">Auto Detected / 自动识别</p>
        <div className="mt-3 space-y-3">
          {detected.length === 0 && <div className="border border-dashed border-brass/30 p-3 text-sm text-paper/60">尚未检测到资料名。试着输入 X、The Grimm Royals、Crenchester 或 Nikki。</div>}
          {detected.map((asset) => (
            <article key={asset.id} className="bg-paper/95 p-3 text-espresso shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="type-label text-crimson">{asset.category} · {asset.id}</p>
                  <h3 className="font-display text-lg">{asset.name}</h3>
                </div>
                <ClassifiedBadge level={asset.spoilerLevel} />
              </div>
              <p className="mt-2 text-sm text-espresso/75">{asset.summary}</p>
            </article>
          ))}
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
    </aside>
  );
}

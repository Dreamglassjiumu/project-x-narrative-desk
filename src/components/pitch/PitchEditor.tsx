import type { AnyAsset, Character, District, Faction, Poi, Storyline } from '../../data';
import type { PitchDraft } from '../../utils/pitch';
import { exportPitchMarkdown, pitchOutlineTemplate, pitchStatuses, pitchTypes } from '../../utils/pitch';

type LinkKey = 'linkedCharacterIds' | 'linkedFactionIds' | 'linkedDistrictIds' | 'linkedPoiIds' | 'linkedStorylineIds';

const MultiAssetPicker = ({ label, assets, value, onChange }: { label: string; assets: AnyAsset[]; value: string[]; onChange: (ids: string[]) => void }) => (
  <label className="block">
    <span className="field-label">{label}</span>
    <select
      multiple
      value={value}
      onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}
      className="paper-input min-h-24 text-sm"
    >
      {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.category}</option>)}
    </select>
  </label>
);

export function PitchEditor({ draft, assets, onChange }: { draft: PitchDraft; assets: { characters: Character[]; factions: Faction[]; districts: District[]; pois: Poi[]; storylines: Storyline[] }; onChange: (draft: PitchDraft) => void }) {
  const update = <K extends keyof PitchDraft>(key: K, value: PitchDraft[K]) => onChange({ ...draft, [key]: value });
  const updateLinks = (key: LinkKey, value: string[]) => update(key, value as PitchDraft[typeof key]);

  const downloadMarkdown = () => {
    const markdown = exportPitchMarkdown(draft, [...assets.characters, ...assets.factions, ...assets.districts, ...assets.pois, ...assets.storylines]);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${draft.title || 'project-x-pitch'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const insertOutline = () => {
    const spacer = draft.body.trim() ? '\n\n' : '';
    update('body', `${draft.body}${spacer}${pitchOutlineTemplate}`);
  };

  return (
    <section className="dossier-panel p-5">
      <div className="mb-5 flex flex-col gap-3 border-b border-brass/30 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="type-label text-crimson">PITCH WRITING DESK / CASE PROPOSAL MANUSCRIPT</p>
          <h2 className="font-display text-3xl text-espresso">Pitch 写作区</h2>
          <p className="mt-1 text-sm text-walnut/70">少量元信息 + 一份长正文。背景、目标、冲突、流程都直接写进正文。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={insertOutline} className="stamp border-walnut text-walnut">Insert Pitch Outline</button>
          <button onClick={downloadMarkdown} className="evidence-button">Export Markdown</button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_180px_180px]">
        <label className="block xl:col-span-1">
          <span className="field-label">Pitch Title / 标题</span>
          <input value={draft.title} onChange={(event) => update('title', event.target.value)} className="paper-input text-lg font-semibold" placeholder="CASE TITLE" />
        </label>
        <label className="block">
          <span className="field-label">Pitch Type / 类型</span>
          <select value={draft.type} onChange={(event) => update('type', event.target.value as PitchDraft['type'])} className="paper-input">
            {pitchTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Pitch Status / 状态</span>
          <select value={draft.status} onChange={(event) => update('status', event.target.value as PitchDraft['status'])} className="paper-input">
            {pitchStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
        <MultiAssetPicker label="Linked Characters / 涉及人物" assets={assets.characters} value={draft.linkedCharacterIds} onChange={(ids) => updateLinks('linkedCharacterIds', ids)} />
        <MultiAssetPicker label="Linked Factions / 涉及帮派" assets={assets.factions} value={draft.linkedFactionIds} onChange={(ids) => updateLinks('linkedFactionIds', ids)} />
        <MultiAssetPicker label="Linked Districts / 发生区域" assets={assets.districts} value={draft.linkedDistrictIds} onChange={(ids) => updateLinks('linkedDistrictIds', ids)} />
        <MultiAssetPicker label="Linked POIs / 涉及地点" assets={assets.pois} value={draft.linkedPoiIds} onChange={(ids) => updateLinks('linkedPoiIds', ids)} />
        <MultiAssetPicker label="Linked Storylines / 关联旧剧情" assets={assets.storylines} value={draft.linkedStorylineIds} onChange={(ids) => updateLinks('linkedStorylineIds', ids)} />
      </div>

      <label className="mt-5 block">
        <span className="field-label">Pitch Body / Pitch 正文</span>
        <textarea
          value={draft.body}
          onChange={(event) => update('body', event.target.value)}
          className="paper-input min-h-[560px] resize-y font-mono text-base leading-7 shadow-inner"
          placeholder="Type the case proposal here... / 在这里写主线、支线 pitch 正文……"
        />
      </label>
    </section>
  );
}

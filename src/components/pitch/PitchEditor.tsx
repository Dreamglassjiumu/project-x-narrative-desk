import { useMemo, useState } from 'react';
import type { AnyAsset, Character, District, Faction, Poi, Storyline } from '../../data';
import type { PitchDraft } from '../../utils/pitch';
import { exportPitchMarkdown, pitchOutlineTemplate, pitchStatuses, pitchTypes } from '../../utils/pitch';

type LinkKey = 'linkedCharacterIds' | 'linkedFactionIds' | 'linkedDistrictIds' | 'linkedPoiIds' | 'linkedStorylineIds';

type DossierGroup = {
  key: LinkKey;
  title: string;
  summaryLabel: string;
  addLabel: string;
  emptyLabel: string;
  assets: AnyAsset[];
};

const matchesArchivePickerQuery = (asset: AnyAsset, query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [asset.name, asset.chineseName, asset.englishName, ...asset.aliases]
    .filter(Boolean)
    .some((term) => term.toLowerCase().includes(normalized));
};

const assetDisplayName = (asset: AnyAsset): string => asset.name || asset.englishName || asset.chineseName || asset.id;

function LinkedDossierGroup({ group, selectedIds, pickerOpen, query, onOpenPicker, onClosePicker, onQueryChange, onAdd, onRemove }: {
  group: DossierGroup;
  selectedIds: string[];
  pickerOpen: boolean;
  query: string;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onQueryChange: (query: string) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const assetsById = useMemo(() => new Map(group.assets.map((asset) => [asset.id, asset])), [group.assets]);
  const filteredAssets = useMemo(
    () => group.assets.filter((asset) => matchesArchivePickerQuery(asset, query)).slice(0, 10),
    [group.assets, query],
  );

  return (
    <div className="relative border border-walnut/20 bg-[#ead8b8]/35 p-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="type-label text-[10px] text-crimson">{group.title}</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-walnut/60">{selectedIds.length} 已关联</p>
        </div>
        <button type="button" className="stamp border-brass bg-brass/10 text-walnut shadow-card transition hover:-translate-y-0.5 hover:bg-brass/20" onClick={onOpenPicker}>
          + {group.addLabel}
        </button>
      </div>

      <div className="mt-3 flex max-h-24 min-h-10 flex-wrap gap-2 overflow-y-auto pr-1">
        {selectedIds.length ? selectedIds.map((id) => {
          const asset = assetsById.get(id);
          return (
            <span key={id} className="inline-flex max-w-full rotate-[-0.4deg] items-center gap-2 border border-walnut/35 bg-paper/90 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-espresso shadow-card">
              <span className="truncate">{asset ? assetDisplayName(asset) : `缺失档案 ${id}`}</span>
              <button type="button" className="text-crimson transition hover:scale-125" aria-label={`Remove ${asset ? assetDisplayName(asset) : id}`} onClick={() => onRemove(id)}>×</button>
            </span>
          );
        }) : <p className="font-mono text-xs italic text-walnut/50">{group.emptyLabel}</p>}
      </div>

      {pickerOpen ? (
        <div className="absolute right-2 top-12 z-20 w-[min(28rem,calc(100vw-3rem))] border border-brass/50 bg-espresso p-3 text-paper shadow-dossier">
          <div className="flex items-start justify-between gap-3 border-b border-brass/25 pb-2">
            <div>
              <p className="type-label text-brass">档案选择器</p>
              <h4 className="font-display text-xl text-ivory">{group.addLabel}</h4>
            </div>
            <button type="button" className="stamp border-paper/40 text-paper/75" onClick={onClosePicker}>关闭</button>
          </div>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="mt-3 w-full border border-brass/40 bg-[#1c120f] px-3 py-2 font-mono text-sm text-paper outline-none placeholder:text-paper/35 focus:border-crimson focus:ring-2 focus:ring-crimson/30"
            placeholder="搜索名称、中文名、英文名或别名"
            autoFocus
          />
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {filteredAssets.map((asset) => {
              const selected = selectedIdSet.has(asset.id);
              return (
                <button
                  key={asset.id}
                  type="button"
                  className={`w-full border p-2 text-left transition ${selected ? 'border-teal/70 bg-teal/15 text-paper/70' : 'border-brass/25 bg-paper/10 hover:-translate-y-0.5 hover:border-brass/70 hover:bg-paper/15'}`}
                  onClick={() => onAdd(asset.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg text-ivory">{assetDisplayName(asset)}</p>
                      <p className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-brass/75">{asset.chineseName} · {asset.englishName}</p>
                    </div>
                    <span className={`stamp shrink-0 ${selected ? 'border-teal text-teal' : 'border-brass text-brass'}`}>{selected ? '已选择' : 'ADD'}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-paper/65">{asset.aliases.length ? `别名： ${asset.aliases.join(', ')}` : asset.summary}</p>
                </button>
              );
            })}
            {filteredAssets.length === 0 ? <p className="border border-dashed border-brass/30 p-3 text-sm text-paper/55">没有匹配的档案。</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LinkedDossiersPanel({ groups, draft, onUpdateLinks }: { groups: DossierGroup[]; draft: PitchDraft; onUpdateLinks: (key: LinkKey, ids: string[]) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [activePicker, setActivePicker] = useState<LinkKey | undefined>();
  const [queries, setQueries] = useState<Record<LinkKey, string>>({
    linkedCharacterIds: '',
    linkedFactionIds: '',
    linkedDistrictIds: '',
    linkedPoiIds: '',
    linkedStorylineIds: '',
  });

  const totalLinked = groups.reduce((sum, group) => sum + draft[group.key].length, 0);
  const summary = groups.map((group) => `${group.summaryLabel} ${draft[group.key].length}`).join(' · ');

  const addLink = (key: LinkKey, id: string) => {
    const currentIds = draft[key];
    if (currentIds.includes(id)) return;
    onUpdateLinks(key, [...currentIds, id]);
  };

  const removeLink = (key: LinkKey, id: string) => onUpdateLinks(key, draft[key].filter((linkedId) => linkedId !== id));

  return (
    <section className="mt-4 border border-brass/35 bg-walnut/10 p-3 shadow-card">
      <button type="button" className="flex w-full flex-wrap items-center justify-between gap-3 text-left" onClick={() => setExpanded((current) => !current)}>
        <div>
          <p className="type-label text-crimson">关联档案</p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-walnut/65">{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="stamp border-brass bg-brass/10 text-walnut">{totalLinked} 已关联</span>
          <span className="stamp border-walnut/50 text-walnut">{expanded ? '收起' : '展开'}</span>
        </div>
      </button>

      {expanded ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {groups.map((group) => (
            <LinkedDossierGroup
              key={group.key}
              group={group}
              selectedIds={draft[group.key]}
              pickerOpen={activePicker === group.key}
              query={queries[group.key]}
              onOpenPicker={() => setActivePicker((current) => current === group.key ? undefined : group.key)}
              onClosePicker={() => setActivePicker(undefined)}
              onQueryChange={(query) => setQueries((current) => ({ ...current, [group.key]: query }))}
              onAdd={(id) => addLink(group.key, id)}
              onRemove={(id) => removeLink(group.key, id)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function PitchEditor({ draft, assets, onChange }: { draft: PitchDraft; assets: { characters: Character[]; factions: Faction[]; districts: District[]; pois: Poi[]; storylines: Storyline[] }; onChange: (draft: PitchDraft) => void }) {
  const update = <K extends keyof PitchDraft>(key: K, value: PitchDraft[K]) => onChange({ ...draft, [key]: value });
  const updateLinks = (key: LinkKey, value: string[]) => update(key, value as PitchDraft[typeof key]);

  const dossierGroups: DossierGroup[] = useMemo(() => [
    { key: 'linkedCharacterIds', title: '关联角色', summaryLabel: '角色', addLabel: '添加角色', emptyLabel: '暂无关联角色。', assets: assets.characters },
    { key: 'linkedFactionIds', title: '关联帮派', summaryLabel: '帮派', addLabel: '添加帮派', emptyLabel: '暂无关联帮派。', assets: assets.factions },
    { key: 'linkedDistrictIds', title: '关联区域', summaryLabel: '区域', addLabel: '添加区域', emptyLabel: '暂无关联区域。', assets: assets.districts },
    { key: 'linkedPoiIds', title: '关联地点', summaryLabel: '地点', addLabel: '添加地点', emptyLabel: '暂无关联地点。', assets: assets.pois },
    { key: 'linkedStorylineIds', title: '关联剧情线', summaryLabel: '剧情线', addLabel: '添加剧情线', emptyLabel: '暂无关联剧情线。', assets: assets.storylines },
  ], [assets]);

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
          <p className="type-label text-crimson">PITCH DESK</p>
          <h2 className="font-display text-3xl text-espresso">Pitch 写作区</h2>
          <p className="mt-1 text-sm text-walnut/70">写 Pitch 正文，并关联已有档案。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={insertOutline} className="stamp border-walnut text-walnut">插入提纲</button>
          <button onClick={downloadMarkdown} className="evidence-button">导出 Markdown</button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_180px_180px]">
        <label className="block xl:col-span-1">
          <span className="field-label">标题</span>
          <input value={draft.title} onChange={(event) => update('title', event.target.value)} className="paper-input text-lg font-semibold" placeholder="请输入标题" />
        </label>
        <label className="block">
          <span className="field-label">类型</span>
          <select value={draft.type} onChange={(event) => update('type', event.target.value as PitchDraft['type'])} className="paper-input">
            {pitchTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">状态</span>
          <select value={draft.status} onChange={(event) => update('status', event.target.value as PitchDraft['status'])} className="paper-input">
            {pitchStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
      </div>

      <LinkedDossiersPanel groups={dossierGroups} draft={draft} onUpdateLinks={updateLinks} />

      <label className="mt-5 block">
        <span className="field-label">正文</span>
        <textarea
          value={draft.body}
          onChange={(event) => update('body', event.target.value)}
          className="paper-input min-h-[620px] resize-y font-mono text-base leading-7 shadow-inner"
          placeholder="在这里写主线、支线 Pitch 正文……"
        />
      </label>
    </section>
  );
}

import type { AssetType } from '../../utils/assetHelpers';
import type { DossierTemplate, DossierTemplateId } from './templateDefaults';
import { templatesForType } from './templateDefaults';
import { characterTypeLabel, spoilerLabel, statusLabel } from '../../i18n/zhCN';

const highlightedTemplateIdsForType = (type?: AssetType): DossierTemplateId[] => {
  if (type === 'factions') return ['faction'];
  if (type === 'characters') return ['playable_hero', 'boss', 'story_npc'];
  if (type === 'districts') return ['district', 'poi'];
  if (type === 'pois') return ['poi'];
  if (type === 'storylines') return ['storyline'];
  if (type === 'design-assets') return ['design_asset'];
  return [];
};

const dossierMeta = (template: DossierTemplate) => {
  const characterType = 'characterType' in template.defaults ? String(template.defaults.characterType) : undefined;
  return [
    ['默认状态', template.defaults.status],
    ['保密等级', template.defaults.spoilerLevel],
    ...(characterType ? [['角色类型', characterType]] : []),
  ].filter(([, value]) => Boolean(value));
};

export function DossierTemplatePicker({ open, type, onPick, onClose }: { open: boolean; type?: AssetType; onPick: (templateId: DossierTemplateId) => void; onClose: () => void }) {
  if (!open) return null;
  const templates = templatesForType(type);
  const highlightedTemplateIds = highlightedTemplateIdsForType(type);

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-espresso/85 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden border-4 border-brass/55 bg-[linear-gradient(135deg,#342018,#1d1714_52%,#140f0d)] p-4 shadow-noir md:p-6">
        <div className="pointer-events-none absolute inset-3 border border-paper/10" />
        <div className="relative max-h-[calc(90vh-3rem)] overflow-y-auto pr-1">
          <div className="mb-5 flex items-start justify-between gap-3 border-b-2 border-dashed border-brass/35 pb-4">
            <div>
              <p className="type-label text-crimson">CASE FOLDER</p>
              <h2 className="font-display text-4xl text-ivory">选择档案类型</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-paper/65">请选择一种档案类型，然后进入表单。</p>
            </div>
            <button className="stamp shrink-0 border-brass text-brass" onClick={onClose}>关闭</button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => {
              const isHighlighted = highlightedTemplateIds.includes(template.id);
              return (
                <button
                  key={template.id}
                  onClick={() => onPick(template.id)}
                  className={`group relative min-h-64 overflow-hidden border bg-paper p-5 text-left shadow-dossier transition hover:-rotate-1 hover:border-crimson hover:shadow-noir ${isHighlighted ? 'border-crimson ring-2 ring-brass/60' : 'border-brass/40'}`}
                >
                  <div className="absolute -right-10 top-8 h-14 w-36 rotate-12 bg-brass/10" />
                  <div className="absolute right-4 top-4 -rotate-6 border-2 border-crimson px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-crimson">{template.stamp}</div>
                  {isHighlighted ? <div className="absolute left-4 top-4 border border-brass bg-espresso px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-brass">当前默认</div> : null}
                  <p className="mt-8 font-mono text-[10px] font-black uppercase tracking-[0.24em] text-walnut/55">档案类型</p>
                  <h3 className="mt-3 font-display text-3xl text-espresso">{template.chineseName}</h3>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-walnut/70">{template.description}</p>
                  <div className="mt-4 space-y-2 border-y border-dashed border-walnut/25 py-3">
                    {dossierMeta(template).map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.14em]">
                        <span className="text-walnut/50">{label}</span>
                        <span className="text-espresso">{label === '默认状态' ? statusLabel(String(value)) : label === '保密等级' ? spoilerLabel(String(value)) : characterTypeLabel(String(value))}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-brass">选择 →</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

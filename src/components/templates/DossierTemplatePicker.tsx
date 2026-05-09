import type { AssetType } from '../../utils/assetHelpers';
import type { DossierTemplateId } from './templateDefaults';
import { templatesForType } from './templateDefaults';

export function DossierTemplatePicker({ open, type, onPick, onClose }: { open: boolean; type?: AssetType; onPick: (templateId: DossierTemplateId) => void; onClose: () => void }) {
  if (!open) return null;
  const templates = templatesForType(type);
  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-espresso/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto border-4 border-brass/50 bg-[linear-gradient(135deg,#2f1d16,#1d1714)] p-5 shadow-noir">
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-brass/30 pb-4">
          <div>
            <p className="type-label text-crimson">SELECT CASE FOLDER TYPE / 选择案卷类型</p>
            <h2 className="font-display text-4xl text-ivory">New Record Intake</h2>
            <p className="mt-2 text-sm text-paper/65">Pick a manila folder template. The defaults are only a starting point; every field stays editable.</p>
          </div>
          <button className="stamp border-brass text-brass" onClick={onClose}>CLOSE CABINET</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <button key={template.id} onClick={() => onPick(template.id)} className="group relative min-h-44 border border-brass/40 bg-paper p-5 text-left shadow-dossier transition hover:-rotate-1 hover:border-crimson hover:shadow-noir">
              <div className="absolute right-4 top-4 -rotate-6 border-2 border-crimson px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-crimson">{template.stamp}</div>
              <p className="type-label text-walnut/55">CASE FOLDER</p>
              <h3 className="mt-7 font-display text-2xl text-espresso">{template.title}</h3>
              <p className="mt-2 text-sm leading-6 text-walnut/70">{template.subtitle}</p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-brass">Open folder →</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

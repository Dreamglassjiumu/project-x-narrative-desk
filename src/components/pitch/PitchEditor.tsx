import type { PitchDraft, PitchType } from '../../utils/pitch';
import { exportPitchMarkdown, pitchFieldLabels } from '../../utils/pitch';

const pitchTypes: PitchType[] = ['主线', '支线', '角色任务', '区域任务', '帮派任务'];

export function PitchEditor({ draft, onChange }: { draft: PitchDraft; onChange: (draft: PitchDraft) => void }) {
  const update = <K extends keyof PitchDraft>(key: K, value: PitchDraft[K]) => onChange({ ...draft, [key]: value });

  const downloadMarkdown = () => {
    const markdown = exportPitchMarkdown(draft);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${draft.title || 'project-x-pitch'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="dossier-panel p-5">
      <div className="mb-5 flex flex-col gap-3 border-b border-brass/30 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="type-label text-crimson">ACTION PROPOSAL / CASE REPORT</p>
          <h2 className="font-display text-2xl text-espresso">Pitch 编辑器</h2>
        </div>
        <button onClick={downloadMarkdown} className="evidence-button">导出 Markdown</button>
      </div>
      <label className="field-label">类型</label>
      <select value={draft.type} onChange={(event) => update('type', event.target.value as PitchType)} className="paper-input mb-4">
        {pitchTypes.map((type) => <option key={type}>{type}</option>)}
      </select>
      <div className="grid gap-4">
        {pitchFieldLabels.map((field) => (
          <label key={field.key}>
            <span className="field-label">{field.label}</span>
            {field.multiline ? (
              <textarea
                value={String(draft[field.key])}
                onChange={(event) => update(field.key, event.target.value as PitchDraft[typeof field.key])}
                className="paper-input min-h-28 resize-y"
                placeholder="打字机记录……"
              />
            ) : (
              <input
                value={String(draft[field.key])}
                onChange={(event) => update(field.key, event.target.value as PitchDraft[typeof field.key])}
                className="paper-input"
                placeholder="CASE TITLE"
              />
            )}
          </label>
        ))}
      </div>
    </section>
  );
}

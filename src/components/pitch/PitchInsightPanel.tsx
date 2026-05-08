import type { AnyAsset } from '../../data';
import { ClassifiedBadge } from '../ui/ClassifiedBadge';

export function PitchInsightPanel({ detected }: { detected: AnyAsset[] }) {
  return (
    <aside className="border border-crimson/40 bg-espresso/80 p-4 shadow-dossier">
      <p className="type-label text-crimson">RED STRING MEMO / 自动扫描</p>
      <h2 className="font-display text-2xl text-ivory">设定风险提醒</h2>
      <p className="mt-2 text-sm text-paper/65">扫描 Pitch 文本中的 name / chineseName / englishName / aliases，并列出对应限制。</p>
      <div className="mt-4 space-y-4">
        {detected.length === 0 && <div className="border border-dashed border-brass/30 p-3 text-sm text-paper/60">尚未检测到资料名。试着输入 Nikki Lockhart、9 Discípulos 或 Crenchester。</div>}
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
            {asset.narrativeConstraints.length > 0 && (
              <div className="mt-3">
                <p className="type-label text-walnut/60">Constraints</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {asset.narrativeConstraints.map((item) => <li key={item} className="border-l-2 border-brass pl-2">{item}</li>)}
                </ul>
              </div>
            )}
            {asset.doNotRevealYet.length > 0 && (
              <div className="mt-3 bg-crimson/10 p-2 text-sm text-crimson">
                <p className="font-mono text-xs uppercase tracking-widest">Do Not Reveal Yet</p>
                {asset.doNotRevealYet.join(' / ')}
              </div>
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}

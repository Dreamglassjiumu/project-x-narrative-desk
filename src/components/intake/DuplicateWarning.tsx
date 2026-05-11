import type { DuplicateHit } from '../../utils/duplicateDetection';

export function DuplicateWarning({ hits, onOpen }: { hits: DuplicateHit[]; onOpen?: (hit: DuplicateHit) => void }) {
  if (!hits.length) return null;
  return (
    <div className="md:col-span-2 border-2 border-crimson/60 bg-crimson/10 p-3">
      <p className="type-label text-crimson">发现可能重复的档案。</p>
      <div className="mt-2 grid gap-2">
        {hits.map((hit) => <button key={hit.asset.id} type="button" className="text-left font-mono text-xs text-espresso underline decoration-crimson/40 underline-offset-4" onClick={() => onOpen?.(hit)}>{hit.strength.toUpperCase()} · {hit.asset.name} · {hit.type} · 匹配 “{hit.matchedTerm}”</button>)}
      </div>
      <p className="mt-2 text-xs text-walnut/60">此提醒不会阻止保存；保存前请确认档案是否重复。</p>
    </div>
  );
}

import type { CompletenessResult } from '../../utils/completeness';
import { missingFieldLabel, zh } from '../../i18n/zhCN';

export function MissingFieldsList({ result }: { result: CompletenessResult }) {
  return (
    <div className="border border-brass/30 bg-espresso/5 p-3">
      <p className="section-title">档案完整度</p>
      <p className="mt-1 font-mono text-xs text-walnut/60">{result.passed}/{result.total} 项检查通过 · 完整度：{result.score}%</p>
      {result.missing.length ? <ul className="mt-2 grid gap-1 font-mono text-xs text-crimson">{result.missing.map((field) => <li key={field}>✗ 缺失：{missingFieldLabel(field)}</li>)}</ul> : <p className="mt-2 font-mono text-xs text-teal">✓ 档案完整。</p>}
    </div>
  );
}

import type { CompletenessResult } from '../../utils/completeness';

export function MissingFieldsList({ result }: { result: CompletenessResult }) {
  return (
    <div className="border border-brass/30 bg-espresso/5 p-3">
      <p className="section-title">Archive Completeness / 完整度检查</p>
      <p className="mt-1 font-mono text-xs text-walnut/60">{result.passed}/{result.total} checks cleared · Completeness: {result.score}%</p>
      {result.missing.length ? <ul className="mt-2 grid gap-1 font-mono text-xs text-crimson">{result.missing.map((field) => <li key={field}>✗ Missing: {field}</li>)}</ul> : <p className="mt-2 font-mono text-xs text-teal">✓ COMPLETE case folder.</p>}
    </div>
  );
}

import type { CompletenessResult } from '../../utils/completeness';

const labels = { complete: '完整', needs_review: '待补充', incomplete: '不完整' };
const classes = { complete: 'border-teal text-teal', needs_review: 'border-brass text-brass', incomplete: 'border-crimson text-crimson' };
export function CompletenessBadge({ result }: { result: CompletenessResult }) {
  return <span className={`stamp ${classes[result.status]}`}>{labels[result.status]} · {result.score}%</span>;
}

import type { CompletenessResult } from '../../utils/completeness';

const labels = { complete: 'COMPLETE', needs_review: 'NEEDS REVIEW', incomplete: 'INCOMPLETE' };
const classes = { complete: 'border-teal text-teal', needs_review: 'border-brass text-brass', incomplete: 'border-crimson text-crimson' };
export function CompletenessBadge({ result }: { result: CompletenessResult }) {
  return <span className={`stamp ${classes[result.status]}`}>{labels[result.status]} · {result.score}%</span>;
}

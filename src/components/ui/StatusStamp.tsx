import type { AssetStatus } from '../../data';

const statusLabel: Record<AssetStatus, string> = {
  canon: 'CANON',
  draft: 'DRAFT',
  deprecated: 'DEPRECATED',
  under_review: 'UNDER REVIEW',
};

export function StatusStamp({ status }: { status: AssetStatus }) {
  return <span className="stamp border-brass/70 text-brass">{statusLabel[status]}</span>;
}

import type { AssetStatus } from '../../data';

const statusLabel: Record<AssetStatus, string> = {
  canon: '正式',
  draft: '草稿',
  deprecated: '已废弃',
  under_review: '审核中',
};

export function StatusStamp({ status }: { status: AssetStatus }) {
  return <span className="stamp border-brass/70 text-brass">{statusLabel[status]}</span>;
}

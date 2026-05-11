import { fileUsageLabel } from '../../i18n/zhCN';

export const fileUsageOptions = ['character_reference', 'faction_reference', 'district_reference', 'poi_reference', 'storyline_reference', 'raw_document', 'moodboard', 'other'] as const;
export type FileUsage = typeof fileUsageOptions[number];
export function EvidenceUsageBadge({ usage }: { usage?: string }) {
  return <span className="tag-label border-brass/50 text-brass">{fileUsageLabel(usage)}</span>;
}

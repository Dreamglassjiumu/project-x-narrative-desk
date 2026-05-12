import type { SpoilerLevel } from '../../data';
import { spoilerLabel } from '../../i18n/zhCN';

export function ClassifiedBadge({ level }: { level: SpoilerLevel }) {
  const secret = level === 'secret';
  return (
    <span className={secret ? 'stamp rotate-[-2deg] border-crimson text-crimson' : 'stamp border-teal/70 text-teal'}>
      {secret ? '机密' : spoilerLabel(level)}
    </span>
  );
}

import type { SpoilerLevel } from '../../data';

export function ClassifiedBadge({ level }: { level: SpoilerLevel }) {
  const secret = level === 'secret';
  return (
    <span className={secret ? 'stamp rotate-[-2deg] border-crimson text-crimson' : 'stamp border-teal/70 text-teal'}>
      {secret ? 'CLASSIFIED / 机密' : level.toUpperCase()}
    </span>
  );
}

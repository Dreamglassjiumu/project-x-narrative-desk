export type ArchiveNoticeTone = 'success' | 'error' | 'info';

export interface ArchiveNoticeMessage {
  id: number;
  tone: ArchiveNoticeTone;
  title: string;
  detail?: string;
}

export type ArchiveNotifier = (notice: Omit<ArchiveNoticeMessage, 'id'>) => void;

const toneClass: Record<ArchiveNoticeTone, string> = {
  success: 'border-teal/70 bg-police/85 text-paper',
  error: 'border-crimson/70 bg-burgundy/90 text-paper',
  info: 'border-brass/70 bg-walnut/90 text-paper',
};

export function ArchiveNoticeStack({ notices, onDismiss }: { notices: ArchiveNoticeMessage[]; onDismiss: (id: number) => void }) {
  if (!notices.length) return null;

  return (
    <div className="fixed right-4 top-20 z-[70] flex w-[min(88vw,360px)] flex-col gap-2 pointer-events-none">
      {notices.map((notice) => (
        <div key={notice.id} className={`pointer-events-auto border-l-4 p-3 shadow-noir backdrop-blur ${toneClass[notice.tone]}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="type-label text-brass">WIRE NOTICE // ARCHIVE STATUS</p>
              <p className="mt-1 font-mono text-sm uppercase tracking-[0.14em]">{notice.title}</p>
              {notice.detail ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-paper/80">{notice.detail}</p> : null}
            </div>
            <button className="stamp border-paper/50 text-paper/80" onClick={() => onDismiss(notice.id)} aria-label="Dismiss archive notice">ACK</button>
          </div>
        </div>
      ))}
    </div>
  );
}

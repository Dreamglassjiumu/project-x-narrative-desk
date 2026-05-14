import { useEffect, useRef } from 'react';

export function ConfirmDialog({ open, title, message, confirmLabel = '确认', onConfirm, onCancel }: { open: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-espresso/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="dossier-panel max-h-[90vh] w-full max-w-md overflow-hidden shadow-noir" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-[3] flex items-start justify-between gap-3 border-b border-brass/30 bg-paper/95 p-5 shadow-card">
          <div>
            <p className="type-label text-crimson">ARCHIVE WARNING / 二次确认</p>
            <h2 id="confirm-dialog-title" className="mt-2 font-display text-3xl text-espresso">{title}</h2>
          </div>
          <button ref={closeRef} className="relative z-[5] shrink-0 border-2 border-crimson bg-espresso px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-paper shadow-[0_0_18px_rgba(139,31,36,0.45)] transition hover:bg-crimson focus:outline-none focus:ring-2 focus:ring-brass" onClick={onCancel}>× 关闭</button>
        </div>
        <div className="max-h-[calc(90vh-9rem)] overflow-y-auto p-5">
          <p className="border-l-4 border-crimson bg-crimson/10 p-3 text-sm leading-6 text-espresso/80">{message}</p>
          <div className="mt-5 flex justify-end gap-3">
            <button className="stamp border-walnut text-walnut" onClick={onCancel}>取消</button>
            <button className="stamp border-crimson text-crimson" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

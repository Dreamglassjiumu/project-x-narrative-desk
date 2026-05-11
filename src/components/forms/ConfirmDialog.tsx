export function ConfirmDialog({ open, title, message, confirmLabel = '确认', onConfirm, onCancel }: { open: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-espresso/80 p-4 backdrop-blur-sm">
      <div className="dossier-panel max-w-md p-6 shadow-noir">
        <p className="type-label text-crimson">ARCHIVE WARNING / 二次确认</p>
        <h2 className="mt-2 font-display text-3xl text-espresso">{title}</h2>
        <p className="mt-3 border-l-4 border-crimson bg-crimson/10 p-3 text-sm leading-6 text-espresso/80">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button className="stamp border-walnut text-walnut" onClick={onCancel}>取消</button>
          <button className="stamp border-crimson text-crimson" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

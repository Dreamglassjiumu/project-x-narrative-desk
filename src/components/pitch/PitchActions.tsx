const disabledReason = 'Local API offline. Archive is read-only.';

export function PitchActions({ disabled, onSave, onDuplicate, onDelete, onConvert }: { disabled?: boolean; onSave: () => void; onDuplicate: () => void; onDelete: () => void; onConvert: () => void }) {
  const title = disabled ? disabledReason : undefined;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button disabled={disabled} title={title} className="evidence-button disabled:cursor-not-allowed disabled:opacity-50" onClick={onSave}>Save Pitch</button>
      <button disabled={disabled} title={title} className="stamp border-brass text-brass disabled:cursor-not-allowed disabled:opacity-50" onClick={onDuplicate}>Duplicate Draft</button>
      <button disabled={disabled} title={title} className="stamp border-crimson text-crimson disabled:cursor-not-allowed disabled:opacity-50" onClick={onDelete}>Delete Pitch</button>
      <button disabled={disabled} title={title} className="stamp border-teal text-teal disabled:cursor-not-allowed disabled:opacity-50" onClick={onConvert}>Convert to Storyline Draft</button>
    </div>
  );
}

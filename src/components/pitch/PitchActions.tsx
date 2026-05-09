const disabledReason = 'Local API offline. Archive is read-only.';

export function PitchActions({ disabled, onSave, onDuplicate, onDelete, onConvert, onClear }: { disabled?: boolean; onSave: () => void; onDuplicate: () => void; onDelete: () => void; onConvert: () => void; onClear: () => void }) {
  const title = disabled ? disabledReason : undefined;
  return (
    <div className="flex flex-wrap gap-2">
      <button disabled={disabled} title={title} className="evidence-button disabled:cursor-not-allowed disabled:opacity-50" onClick={onSave}>Save Pitch</button>
      <button disabled={disabled} title={title} className="stamp border-brass text-brass disabled:cursor-not-allowed disabled:opacity-50" onClick={onDuplicate}>Duplicate</button>
      <button disabled={disabled} title={title} className="stamp border-crimson text-crimson disabled:cursor-not-allowed disabled:opacity-50" onClick={onDelete}>Delete</button>
      <button disabled={disabled} title={title} className="stamp border-teal text-teal disabled:cursor-not-allowed disabled:opacity-50" onClick={onConvert}>Convert to Storyline Draft</button>
      <button className="stamp border-walnut text-walnut" onClick={onClear}>Clear Draft</button>
    </div>
  );
}

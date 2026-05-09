export function FieldArrayInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (value: string[]) => void; placeholder?: string }) {
  const text = value.join('\n');
  return (
    <label>
      <span className="field-label">{label}</span>
      <textarea className="paper-input min-h-20 resize-y" value={text} placeholder={placeholder ?? 'One per typewriter line'} onChange={(event) => onChange(event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} />
    </label>
  );
}

import { useState } from 'react';

export function TagChipInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (value: string[]) => void; placeholder?: string }) {
  const [entry, setEntry] = useState('');
  const add = (raw = entry) => {
    const items = raw.split(',').map((item) => item.trim()).filter(Boolean);
    if (!items.length) return;
    onChange([...value, ...items.filter((item) => !value.some((existing) => existing.toLowerCase() === item.toLowerCase()))]);
    setEntry('');
  };
  const remove = (item: string) => onChange(value.filter((current) => current !== item));
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="paper-input min-h-20">
        <div className="flex flex-wrap gap-2">
          {value.map((item) => (
            <span key={item} className="tag-label inline-flex items-center gap-2">
              {item}
              <button type="button" className="font-mono text-crimson" aria-label={`Remove ${item}`} onClick={() => remove(item)}>×</button>
            </span>
          ))}
          <input
            className="min-w-36 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-walnut/45"
            value={entry}
            placeholder={placeholder ?? 'Type and press Enter'}
            onChange={(event) => setEntry(event.target.value)}
            onBlur={() => add()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); add(); }
              if (event.key === ',' && entry.trim()) { event.preventDefault(); add(); }
            }}
          />
        </div>
      </div>
    </label>
  );
}

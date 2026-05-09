import { TagChipInput } from './TagChipInput';

export function FieldArrayInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (value: string[]) => void; placeholder?: string }) {
  return <TagChipInput label={label} value={value} onChange={onChange} placeholder={placeholder} />;
}

import type { AnyAsset } from '../../data';
import type { AssetType } from '../../utils/assetHelpers';
import { assetTypeLabels } from '../../utils/assetHelpers';
import type { AssetBundle } from '../../utils/api';

export function RelationPicker({ label, type, value, bundle, onChange }: { label: string; type: AssetType; value: string[]; bundle: AssetBundle; onChange: (value: string[]) => void }) {
  const options = bundle[type] as AnyAsset[];
  return (
    <label>
      <span className="field-label">{label}</span>
      <select multiple className="paper-input min-h-28" value={value} onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}>
        {options.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.chineseName || assetTypeLabels[type]}</option>)}
      </select>
      <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.22em] text-walnut/55">按住 Ctrl/Cmd 可选择多个档案；保存时会记录档案 ID。</span>
    </label>
  );
}

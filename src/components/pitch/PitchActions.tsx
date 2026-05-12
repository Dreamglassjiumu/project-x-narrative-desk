const disabledReason = '本地接口离线，当前为只读模式。';

export function PitchActions({ disabled, onSave, onDuplicate, onDelete, onConvert, onClear }: { disabled?: boolean; onSave: () => void; onDuplicate: () => void; onDelete: () => void; onConvert: () => void; onClear: () => void }) {
  const title = disabled ? disabledReason : undefined;
  return (
    <div className="flex flex-wrap gap-2">
      <button disabled={disabled} title={title} className="evidence-button disabled:cursor-not-allowed disabled:opacity-50" onClick={onSave}>保存</button>
      <button disabled={disabled} title={title} className="stamp border-brass text-brass disabled:cursor-not-allowed disabled:opacity-50" onClick={onDuplicate}>复制</button>
      <button disabled={disabled} title={title} className="stamp border-crimson text-crimson disabled:cursor-not-allowed disabled:opacity-50" onClick={onDelete}>删除</button>
      <button disabled={disabled} title={title} className="stamp border-teal text-teal disabled:cursor-not-allowed disabled:opacity-50" onClick={onConvert}>转为剧情线草稿</button>
      <button className="stamp border-walnut text-walnut" onClick={onClear}>清空</button>
    </div>
  );
}

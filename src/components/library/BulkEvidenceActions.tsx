import { useState } from 'react';
import type { UploadedFileRecord } from '../../utils/api';
import { updateUpload } from '../../utils/api';
import { TagChipInput } from '../forms/TagChipInput';
import { fileUsageOptions } from './EvidenceUsageBadge';
import { fileUsageLabel } from '../../i18n/zhCN';

export function BulkEvidenceActions({ selected, files, disabled, onSaved }: { selected: string[]; files: UploadedFileRecord[]; disabled?: boolean; onSaved: (files: UploadedFileRecord[]) => void }) {
  const [tags, setTags] = useState<string[]>([]);
  const [fileUsage, setFileUsage] = useState('');
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    setBusy(true);
    try {
      const updates = await Promise.all(files.filter((file) => selected.includes(file.id)).map((file) => updateUpload(file.id, {
        tags: [...new Set([...(file.tags ?? []), ...tags])],
        linkedAssetIds: file.linkedAssetIds ?? [],
        fileUsage: fileUsage || file.fileUsage || 'other',
      })));
      const map = new Map(updates.map((file) => [file.id, file]));
      onSaved(files.map((file) => map.get(file.id) ?? file));
      setTags([]);
    } finally { setBusy(false); }
  };
  return (
    <div className="mb-4 border border-brass/30 bg-espresso/5 p-3">
      <p className="type-label text-crimson">批量整理</p>
      <p className="mt-1 font-mono text-xs text-walnut/60">{selected.length} 个证物文件已选择。</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
        <TagChipInput label="添加标签" value={tags} onChange={setTags} />
        <label><span className="field-label">文件用途</span><select className="paper-input" value={fileUsage} onChange={(e) => setFileUsage(e.target.value)}><option value="">保持当前用途</option>{fileUsageOptions.map((item) => <option key={item} value={item}>{fileUsageLabel(item)}</option>)}</select></label>
        <button className="evidence-button disabled:opacity-50" disabled={disabled || busy || selected.length === 0 || (!tags.length && !fileUsage)} onClick={() => void apply()}>{busy ? '正在处理…' : '应用'}</button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { AssetBundle, UploadedFileRecord } from '../../utils/api';
import { flattenAssets } from '../../utils/api';
import { TagChipInput } from '../forms/TagChipInput';
import { fileUsageOptions } from './EvidenceUsageBadge';
import { fileUsageLabel } from '../../i18n/zhCN';

export function FileBindDialog({ file, bundle, onClose, onSave }: { file?: UploadedFileRecord; bundle: AssetBundle; onClose: () => void; onSave: (metadata: { tags: string[]; linkedAssetIds: string[]; fileUsage?: string }) => void }) {
  const [tags, setTags] = useState<string[]>([]);
  const [linkedAssetIds, setLinkedAssetIds] = useState<string[]>([]);
  const [fileUsage, setFileUsage] = useState('other');
  useEffect(() => { setTags(file?.tags ?? []); setLinkedAssetIds(file?.linkedAssetIds ?? []); setFileUsage(file?.fileUsage || 'other'); }, [file]);
  if (!file) return null;
  const assets = flattenAssets(bundle);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-espresso/80 p-4 backdrop-blur-sm">
      <div className="dossier-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <p className="type-label text-crimson">EVIDENCE</p>
        <h2 className="font-display text-3xl text-espresso">绑定证物</h2>
        <p className="mt-2 font-mono text-xs text-walnut/60">{file.name}</p>
        <div className="mt-4 grid gap-4">
          <TagChipInput label="证物标签" value={tags} onChange={setTags} />
          <label><span className="field-label">文件用途</span><select className="paper-input" value={fileUsage} onChange={(event) => setFileUsage(event.target.value)}>{fileUsageOptions.map((option) => <option key={option} value={option}>{fileUsageLabel(option)}</option>)}</select></label>
          <label><span className="field-label">已绑定档案</span><select multiple className="paper-input min-h-64" value={linkedAssetIds} onChange={(event) => setLinkedAssetIds(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.category} · {asset.name} · {asset.chineseName}</option>)}</select></label>
        </div>
        <div className="mt-5 flex justify-end gap-3"><button className="stamp border-walnut text-walnut" onClick={onClose}>取消</button><button className="evidence-button" onClick={() => onSave({ tags, linkedAssetIds, fileUsage })}>保存</button></div>
      </div>
    </div>
  );
}

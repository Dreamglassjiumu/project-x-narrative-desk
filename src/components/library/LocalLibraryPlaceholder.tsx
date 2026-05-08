import { useState } from 'react';
import { createLocalLibraryFile, type LocalLibraryFile } from '../../utils/localLibrary';

export function LocalLibraryPlaceholder() {
  const [files, setFiles] = useState<LocalLibraryFile[]>([
    { id: 'mock-001', name: 'san-libre-polaroid-scan.jpg', type: 'image/jpeg', size: 184000, addedAt: new Date().toISOString() },
    { id: 'mock-002', name: 'lockhart-tape-transcript.txt', type: 'text/plain', size: 9200, addedAt: new Date().toISOString() },
  ]);

  const onFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setFiles((current) => [...Array.from(fileList).map(createLocalLibraryFile), ...current]);
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
      <div className="border-2 border-dashed border-brass/40 bg-walnut/45 p-8 text-center shadow-dossier">
        <p className="type-label text-crimson">EVIDENCE LOCKER / 本地证物柜</p>
        <h2 className="mt-2 font-display text-3xl text-ivory">Drop Local Files</h2>
        <p className="mx-auto mt-3 max-w-md text-paper/70">当前版本仅做本地 UI 占位；后续将接入 IndexedDB 保存上传证物，不进行云同步。</p>
        <label className="mt-6 inline-flex cursor-pointer evidence-button">
          选择证物文件
          <input type="file" multiple className="hidden" onChange={(event) => onFiles(event.target.files)} />
        </label>
      </div>
      <div className="dossier-panel p-5">
        <div className="mb-4 border-b border-brass/30 pb-3">
          <p className="type-label text-crimson">LOCKER INDEX</p>
          <h3 className="font-display text-2xl text-espresso">文件列表</h3>
        </div>
        <div className="space-y-3">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-4 border border-walnut/20 bg-espresso/5 p-3">
              <div>
                <p className="font-mono text-sm text-espresso">{file.name}</p>
                <p className="text-xs text-walnut/60">{file.type} · {(file.size / 1024).toFixed(1)} KB · {new Date(file.addedAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))} className="stamp border-crimson text-crimson">DELETE</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

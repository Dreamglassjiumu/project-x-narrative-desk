import { useEffect, useRef, useState } from 'react';
import { deleteUpload, listUploads, uploadFiles, type UploadedFileRecord } from '../../utils/api';

const formatSize = (size: number) => {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

export function LocalLibraryPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setFiles(await listUploads());
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '无法读取 uploads 文件夹');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setBusy(true);
    try {
      const uploaded = await uploadFiles(fileList);
      setFiles((current) => [...uploaded, ...current]);
      setError(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '上传失败');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(`确认从本机 uploads 文件夹删除「${name}」？此操作不会影响 Git，但也不能从证物柜恢复。`);
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteUpload(id);
      setFiles((current) => current.filter((item) => item.id !== id));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '删除失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
      <div className="border-2 border-dashed border-brass/40 bg-walnut/45 p-8 text-center shadow-dossier">
        <p className="type-label text-crimson">EVIDENCE LOCKER / 本地证物柜</p>
        <h2 className="mt-2 font-display text-3xl text-ivory">上传本地文件</h2>
        <p className="mx-auto mt-3 max-w-md text-paper/70">图片、Markdown、JSON、TXT、PDF、Word、Excel 等证物会通过本地 API 写入项目根目录的 uploads/images 或 uploads/documents；当前文件保存在本机 uploads 文件夹，不会自动同步。</p>
        <label className={`mt-6 inline-flex cursor-pointer evidence-button ${busy ? 'opacity-60' : ''}`}>
          {busy ? '处理中...' : '选择证物文件'}
          <input ref={inputRef} type="file" multiple accept="image/*,.md,.markdown,.json,.txt,.pdf,.doc,.docx,.xls,.xlsx,.csv" className="hidden" disabled={busy} onChange={(event) => void onFiles(event.target.files)} />
        </label>
        <button onClick={() => void refresh()} className="stamp ml-3 border-brass text-brass" disabled={busy || loading}>刷新</button>
        {error ? <p className="mt-4 border border-crimson/50 bg-burgundy/45 p-3 font-mono text-xs text-paper">本地接口错误 · {error}</p> : null}
      </div>
      <div className="dossier-panel p-5">
        <div className="mb-4 border-b border-brass/30 pb-3">
          <p className="type-label text-crimson">LOCKER INDEX</p>
          <h3 className="font-display text-2xl text-espresso">文件列表</h3>
        </div>
        <div className="space-y-3">
          {loading ? <p className="font-mono text-sm text-walnut/60">正在读取 uploads 文件夹...</p> : null}
          {!loading && files.length === 0 ? <p className="border border-dashed border-walnut/20 bg-espresso/5 p-4 text-sm text-walnut/60">证物柜为空。上传的文件会出现在这里。</p> : null}
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-4 border border-walnut/20 bg-espresso/5 p-3">
              <div>
                <a href={file.url} target="_blank" rel="noreferrer" className="font-mono text-sm text-espresso underline decoration-walnut/30 underline-offset-4">{file.name}</a>
                <p className="text-xs text-walnut/60">{file.type || '未知'} · {file.folder ?? 'uploads'} · {formatSize(file.size)} · {new Date(file.addedAt).toLocaleString()}</p>
              </div>
              <button onClick={() => void onDelete(file.id, file.name)} disabled={busy} className="stamp border-crimson text-crimson disabled:opacity-50">删除</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useState } from 'react';
import type { AnyAsset } from '../../data';
import type { UploadedFileRecord } from '../../utils/api';
import { EvidenceLightbox } from '../evidence/EvidenceLightbox';

const formatSize = (size: number) => size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;
const isImage = (file: UploadedFileRecord) => file.folder === 'images' || file.type?.startsWith('image/');

export function LinkedFileList({ files, assets = [] }: { files: UploadedFileRecord[]; assets?: AnyAsset[] }) {
  const [lightboxFile, setLightboxFile] = useState<UploadedFileRecord | null>(null);
  const imageFiles = files.filter(isImage);
  if (!files.length) return <p className="text-sm text-walnut/60">No physical evidence linked to this dossier.</p>;
  return (
    <div className="grid gap-3">
      {files.map((file) => {
        const image = isImage(file);
        const body = <><div className="min-w-0">{image ? <img src={file.url} alt={file.name} className="h-16 w-16 object-cover sepia" /> : <div className="grid h-16 w-16 place-items-center bg-walnut/10 font-mono text-[10px] uppercase text-walnut">DOC</div>}</div><div className="min-w-0"><p className="truncate font-mono text-xs text-espresso underline decoration-walnut/30 underline-offset-4">{file.name}</p><p className="mt-1 text-xs text-walnut/60">{file.type || 'unknown'} · {formatSize(file.size)} · {new Date(file.addedAt).toLocaleString()}</p><div className="mt-1 flex flex-wrap gap-1">{file.tags?.map((tag) => <span key={tag} className="tag-label text-[10px]">{tag}</span>)}</div></div></>;
        return image ? <button key={file.id} onClick={() => setLightboxFile(file)} className="flex gap-3 border border-walnut/20 bg-espresso/5 p-2 text-left hover:border-crimson/40">{body}</button> : <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="flex gap-3 border border-walnut/20 bg-espresso/5 p-2 hover:border-crimson/40">{body}</a>;
      })}
      {lightboxFile ? <EvidenceLightbox image={lightboxFile} imageList={imageFiles} initialIndex={Math.max(0, imageFiles.findIndex((file) => file.id === lightboxFile.id))} assets={assets} onClose={() => setLightboxFile(null)} /> : null}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnyAsset } from '../../data';
import type { UploadedFileRecord } from '../../utils/api';
import { zh } from '../../i18n/zhCN';

const formatSize = (size: number) => size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;
const isImage = (file?: UploadedFileRecord) => file?.folder === 'images' || file?.type?.startsWith('image/');

type LightboxAction = (file: UploadedFileRecord) => void;

export function EvidenceLightbox({ image, imageList, initialIndex = 0, assets = [], onClose, onSetPrimary, onBind, onOpenDossier }: { image?: UploadedFileRecord; imageList?: UploadedFileRecord[]; initialIndex?: number; assets?: AnyAsset[]; onClose: () => void; onSetPrimary?: LightboxAction; onBind?: LightboxAction; onOpenDossier?: (asset: AnyAsset) => void }) {
  const images = useMemo(() => (imageList?.length ? imageList : image ? [image] : []).filter(isImage), [image, imageList]);
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)));
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState(true);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const current = images[index];
  const linkedAssets = useMemo(() => current?.linkedAssetIds?.map((id) => assets.find((asset) => asset.id === id)).filter(Boolean) as AnyAsset[] ?? [], [assets, current]);
  const primaryFor = useMemo(() => assets.filter((asset) => asset.primaryEvidenceId === current?.id || asset.primaryEvidenceId === current?.filename), [assets, current]);

  useEffect(() => { setIndex(Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0))); }, [initialIndex, images.length]);
  useEffect(() => { setZoom(1); setFitMode(true); setOffset({ x: 0, y: 0 }); setLoadError(false); }, [index, current?.id]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    lightboxRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'ArrowLeft' && images.length > 1) setIndex((value) => (value - 1 + images.length) % images.length);
      if (event.key === 'ArrowRight' && images.length > 1) setIndex((value) => (value + 1) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [images.length, onClose]);

  if (!current) return null;
  const changeZoom = (next: number) => { setFitMode(false); setZoom(Math.min(4, Math.max(0.25, next))); };
  const copyPath = () => void navigator.clipboard?.writeText(current.url || `uploads/${current.folder}/${current.filename}`).catch(() => undefined);

  return (
    <div
      ref={lightboxRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`${zh.lightbox.title}: ${current.name}`}
      className="fixed inset-0 z-[90] bg-black/90 p-4 pb-24 pt-20 text-paper outline-none backdrop-blur-sm"
      onClick={onClose}
      onMouseUp={() => setDrag(null)}
    >
      <button
        type="button"
        className="fixed right-4 top-4 z-[120] border-2 border-crimson bg-espresso/95 px-4 py-3 font-mono text-xs font-black uppercase tracking-[0.22em] text-paper shadow-[0_0_24px_rgba(139,31,36,0.65)] transition hover:bg-crimson focus:outline-none focus:ring-2 focus:ring-brass"
        aria-label={zh.buttons.close}
        onClick={(event) => { event.stopPropagation(); onClose(); }}
      >
        关闭 ×
      </button>

      <div className="fixed inset-x-4 bottom-4 z-[115] flex flex-wrap items-center justify-center gap-2 border border-brass/40 bg-espresso/85 p-3 shadow-noir backdrop-blur-md" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="stamp border-paper/70 bg-black/20 text-paper" onClick={onClose}>{zh.buttons.close}</button>
        <button type="button" className="stamp border-brass bg-black/20 text-brass" onClick={() => changeZoom(zoom + 0.25)}>{zh.buttons.zoomIn}</button>
        <button type="button" className="stamp border-brass bg-black/20 text-brass" onClick={() => changeZoom(zoom - 0.25)}>{zh.buttons.zoomOut}</button>
        <button type="button" className="stamp border-brass bg-black/20 text-brass" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); setFitMode(false); }}>{zh.buttons.reset}</button>
        <button type="button" className="stamp border-brass bg-black/20 text-brass" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); setFitMode(true); }}>{zh.buttons.fitToScreen}</button>
        {images.length > 1 ? <><button type="button" className="stamp border-brass bg-black/20 text-brass" onClick={() => setIndex((value) => (value - 1 + images.length) % images.length)}>{zh.buttons.previous}</button><button type="button" className="stamp border-brass bg-black/20 text-brass" onClick={() => setIndex((value) => (value + 1) % images.length)}>{zh.buttons.next}</button></> : null}
      </div>

      <div className="relative z-10 grid h-full grid-rows-[auto_1fr_auto] gap-3" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-3 border border-brass/30 bg-espresso/80 p-3 pr-36 shadow-noir">
          <div><p className="type-label text-crimson">暗房证物查看器</p><h2 className="font-display text-2xl text-paper">{current.name}</h2></div>
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-paper/70">Esc / 点击黑色遮罩关闭</div>
        </div>
        <div className="relative grid min-h-0 place-items-center overflow-hidden border border-brass/25 bg-[radial-gradient(circle_at_center,rgba(214,160,75,0.18),rgba(9,7,6,0.9)_55%)] p-4">
          {images.length > 1 ? <><button type="button" className="absolute left-4 z-20 evidence-button" onClick={() => setIndex((value) => (value - 1 + images.length) % images.length)}>{zh.buttons.previous}</button><button type="button" className="absolute right-4 z-20 evidence-button" onClick={() => setIndex((value) => (value + 1) % images.length)}>{zh.buttons.next}</button></> : null}
          <div className="relative max-h-full max-w-full border-[12px] border-paper bg-paper p-2 shadow-[0_18px_60px_rgba(0,0,0,0.75)] after:absolute after:right-3 after:top-3 after:-rotate-12 after:border-2 after:border-crimson after:px-3 after:py-1 after:font-mono after:text-xs after:font-black after:uppercase after:tracking-[0.25em] after:text-crimson after:content-['EVIDENCE']">
            {loadError ? <div className="grid h-80 w-[min(80vw,720px)] place-items-center bg-espresso/90 font-mono text-crimson">证物图片加载失败。</div> : <img src={current.url} alt={current.name} draggable={false} onError={() => setLoadError(true)} onMouseDown={(event) => setDrag({ x: event.clientX - offset.x, y: event.clientY - offset.y })} onMouseMove={(event) => { if (drag) setOffset({ x: event.clientX - drag.x, y: event.clientY - drag.y }); }} className={`${fitMode ? 'max-h-[60vh] max-w-[82vw] object-contain' : 'max-h-none max-w-none cursor-grab'} select-none sepia-[0.15]`} style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: 'center' }} />}
          </div>
        </div>
        <div className="grid gap-3 border border-brass/30 bg-espresso/85 p-3 md:grid-cols-[1fr_auto]">
          <div className="grid gap-1 font-mono text-xs text-paper/80 md:grid-cols-2"><span>文件类型：{current.type || zh.unknown}</span><span>大小：{formatSize(current.size)}</span><span>上传时间：{new Date(current.addedAt).toLocaleString()}</span><span>路径：uploads/{current.folder}/{current.filename}</span><span>已绑定档案：{linkedAssets.map((asset) => asset.name).join(', ') || zh.none}</span><span>主图用于：{primaryFor.map((asset) => asset.name).join(', ') || zh.none}</span></div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">{onSetPrimary ? <button type="button" className="stamp border-crimson text-crimson" onClick={() => onSetPrimary(current)}>{zh.buttons.setPrimaryEvidence}</button> : null}{onBind ? <button type="button" className="stamp border-brass text-brass" onClick={() => onBind(current)}>{zh.buttons.bindToDossier}</button> : null}{linkedAssets[0] && onOpenDossier ? <button type="button" className="stamp border-brass text-brass" onClick={() => onOpenDossier(linkedAssets[0])}>{zh.evidence.openLinkedDossier}</button> : null}<button type="button" className="stamp border-paper/70 text-paper" onClick={copyPath}>{zh.evidence.copyPath}</button></div>
        </div>
      </div>
    </div>
  );
}

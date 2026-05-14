import { archiveErrorMessage, uploadFiles, type UploadedFileRecord } from './api';
import type { ArchiveNotifier } from '../components/ui/ArchiveNotice';

export const clipboardScreenshotNotes = 'Created from clipboard screenshot.';
const screenshotTags = ['clipboard', 'screenshot'];

export const clipboardImageFromEvent = (event: ClipboardEvent): File | null => {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.kind === 'file' && ['image/png', 'image/jpeg'].includes(item.type));
  if (!imageItem) return null;
  const blob = imageItem.getAsFile();
  if (!blob) return null;
  const extension = imageItem.type === 'image/jpeg' ? 'jpg' : 'png';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return new File([blob], `clipboard-screenshot-${stamp}.${extension}`, { type: imageItem.type });
};

export const clipboardPlainTextFromEvent = (event: ClipboardEvent): string => event.clipboardData?.getData('text/plain')?.trim() || '';

export const uploadClipboardScreenshot = async (file: File) => {
  const [uploaded] = await uploadFiles([file], { tags: screenshotTags, fileUsage: 'other', note: clipboardScreenshotNotes });
  return uploaded;
};

export const notifyClipboardError = (error: unknown, notify: ArchiveNotifier) => {
  notify({ tone: 'error', title: archiveErrorMessage(error, '截图保存失败。') });
};

export const isEditablePasteTarget = (target: EventTarget | null) => {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable;
};

export const mergeUploadedIntoFiles = (uploaded: UploadedFileRecord, files: UploadedFileRecord[]) => [uploaded, ...files.filter((file) => file.id !== uploaded.id)];

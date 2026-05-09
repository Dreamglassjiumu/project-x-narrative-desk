import type { AnyAsset, Character, District, Faction, Poi, Storyline } from '../data/types';
import type { AssetType } from './assetHelpers';
import type { PitchDraft, SavedPitch } from './pitch';

export interface AssetBundle {
  factions: Faction[];
  districts: District[];
  pois: Poi[];
  characters: Character[];
  storylines: Storyline[];
  pitches: SavedPitch[];
}

export interface UploadedFileRecord {
  id: string;
  name: string;
  filename: string;
  type: string;
  folder?: 'images' | 'documents';
  size: number;
  addedAt: string;
  url: string;
  tags: string[];
  linkedAssetIds: string[];
  fileUsage?: string;
}

export interface ArchiveExport extends Partial<AssetBundle> {
  exportedAt: string;
  version: string;
}

export const emptyAssetBundle: AssetBundle = {
  factions: [],
  districts: [],
  pois: [],
  characters: [],
  storylines: [],
  pitches: [],
};


export function archiveErrorMessage(error: unknown, fallback = 'Write failed') {
  const message = error instanceof Error ? error.message : String(error || fallback);
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) return 'Local API offline';
  if (/file too large/i.test(message)) return 'File too large';
  if (/unsupported file type/i.test(message)) return 'Unsupported file type';
  if (/upload/i.test(fallback)) return message || 'Upload failed';
  return message || fallback;
}

const requestJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export const fetchAssetBundle = () => requestJson<AssetBundle>('/api/assets');

export const flattenAssets = (bundle: AssetBundle): AnyAsset[] => [
  ...bundle.factions,
  ...bundle.districts,
  ...bundle.pois,
  ...bundle.characters,
  ...bundle.storylines,
];

export const createAsset = <T extends AnyAsset>(type: AssetType, asset: Partial<T>) =>
  requestJson<T>(`/api/assets/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(asset) });

export const updateAsset = <T extends AnyAsset>(type: AssetType, id: string, asset: Partial<T>) =>
  requestJson<T>(`/api/assets/${type}/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(asset) });

export const deleteAsset = (type: AssetType, id: string) =>
  requestJson<void>(`/api/assets/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const listUploads = () => requestJson<UploadedFileRecord[]>('/api/uploads');

export const uploadFiles = async (files: FileList | File[], metadata?: { tags?: string[]; linkedAssetIds?: string[]; fileUsage?: string }) => {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append('files', file));
  if (metadata?.tags) formData.append('tags', JSON.stringify(metadata.tags));
  if (metadata?.linkedAssetIds) formData.append('linkedAssetIds', JSON.stringify(metadata.linkedAssetIds));
  if (metadata?.fileUsage) formData.append('fileUsage', metadata.fileUsage);
  return requestJson<UploadedFileRecord[]>('/api/uploads', { method: 'POST', body: formData });
};

export const updateUpload = (id: string, metadata: { tags?: string[]; linkedAssetIds?: string[]; fileUsage?: string }) =>
  requestJson<UploadedFileRecord>(`/api/uploads/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata) });

export const deleteUpload = async (id: string) => requestJson<void>(`/api/uploads/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const savePitch = (pitch: Partial<SavedPitch> & PitchDraft) =>
  requestJson<SavedPitch>('/api/assets/pitches', { method: pitch.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pitch) });

export const upsertPitch = (pitch: Partial<SavedPitch> & PitchDraft) => {
  if (pitch.id) return requestJson<SavedPitch>(`/api/assets/pitches/${encodeURIComponent(pitch.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pitch) });
  return requestJson<SavedPitch>('/api/assets/pitches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pitch) });
};
export const deletePitch = (id: string) => deleteAsset('pitches' as AssetType, id);

export const exportArchive = () => requestJson<ArchiveExport>('/api/backup/export');
export const importArchive = (payload: ArchiveExport, mode: 'merge' | 'replace') =>
  requestJson<AssetBundle>('/api/backup/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, mode }) });

export type IntakeParserMode = 'Auto Detect' | 'Faction Sheet' | 'Character Sheet' | 'District Sheet' | 'POI Sheet' | 'Storyline Sheet' | 'Raw Text' | 'Image Evidence' | 'Existing Archive JSON' | 'Sheet' | 'raw_document';
export type IntakeDraftStatus = 'needs_review' | 'filed' | 'rejected';
export interface IntakeDraft {
  id: string;
  targetType: AssetType;
  asset: AnyAsset;
  sourceFileId: string;
  sourceFileName: string;
  sourceFilePath: string;
  parserMode: IntakeParserMode | string;
  status: IntakeDraftStatus;
  createdAt: string;
  updatedAt: string;
  filedAssetId?: string;
}
export interface IntakeParseResponse {
  file: UploadedFileRecord;
  parserMode: IntakeParserMode | string;
  status: 'parsed' | 'needs_review' | 'failed';
  message?: string;
  preview?: { kind: 'sheet'; headers: string[]; rows: string[][]; guessedMapping: Record<string, string> } | { kind: 'text'; text: string; chunks: Array<{ name: string; details: string }> } | { kind: 'json'; json: unknown };
  drafts: IntakeDraft[];
}
export const parseIntakeFile = (payload: { fileId: string; parserMode?: string; targetType?: AssetType; mapping?: Record<string, string>; createDrafts?: boolean; textSplitMode?: 'full' | 'headings' | 'separator'; separator?: string; template?: string }) =>
  requestJson<IntakeParseResponse>('/api/intake/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const listIntakeDrafts = () => requestJson<IntakeDraft[]>('/api/intake/drafts');
export const saveIntakeDrafts = (drafts: IntakeDraft | IntakeDraft[]) => requestJson<IntakeDraft[]>('/api/intake/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(drafts) });
export const updateIntakeDraft = (id: string, draft: Partial<IntakeDraft>) => requestJson<IntakeDraft>(`/api/intake/drafts/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
export const rejectIntakeDraft = (id: string) => requestJson<void>(`/api/intake/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const fileIntakeDraft = (id: string, options?: { mergeIntoId?: string }) => requestJson<{ draft: IntakeDraft; asset: AnyAsset }>(`/api/intake/drafts/${encodeURIComponent(id)}/file`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options || {}) });
export const fileIntakeDraftBatch = (ids: string[]) => requestJson<{ backup: { filename: string; path: string }; filed: AnyAsset[] }>('/api/intake/drafts/file-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
export const createIntakeBackup = () => requestJson<{ filename: string; path: string }>('/api/intake/backup', { method: 'POST' });

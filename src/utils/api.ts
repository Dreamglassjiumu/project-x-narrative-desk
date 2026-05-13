import type { AnyAsset, Character, DesignAsset, District, Faction, Poi, Storyline } from '../data/types';
import type { AssetType } from './assetHelpers';
import type { PitchDraft, SavedPitch } from './pitch';

export interface AssetBundle {
  factions: Faction[];
  districts: District[];
  pois: Poi[];
  characters: Character[];
  storylines: Storyline[];
  'design-assets': DesignAsset[];
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
  note?: string;
  caption?: string;
  ocr?: OcrResult;
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
  'design-assets': [],
  pitches: [],
};


import { translateArchiveMessage } from '../i18n/zhCN';

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function archiveErrorMessage(error: unknown, fallback = '写入失败。') {
  const message = error instanceof Error ? error.message : String(error || fallback);
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) return translateArchiveMessage('Local API offline');
  if (/file too large/i.test(message)) return 'File too large';
  if (/unsupported file type/i.test(message)) return translateArchiveMessage('Unsupported file type');
  if (/upload|上传/i.test(fallback)) return translateArchiveMessage(message || 'Upload failed');
  return translateArchiveMessage(message || fallback);
}

const requestJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    const message = typeof body === 'object' && body && 'error' in body ? String((body as { error?: unknown }).error || `${response.status} ${response.statusText}`) : `${response.status} ${response.statusText}`;
    throw new ApiError(message, response.status, body);
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
  ...bundle['design-assets'],
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

export const updateUpload = (id: string, metadata: { tags?: string[]; linkedAssetIds?: string[]; fileUsage?: string; note?: string; caption?: string }) =>
  requestJson<UploadedFileRecord>(`/api/uploads/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata) });

export const deleteUpload = async (id: string) => requestJson<void>(`/api/uploads/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const savePitch = (pitch: Partial<SavedPitch> & PitchDraft) =>
  requestJson<SavedPitch>('/api/assets/pitches', { method: pitch.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pitch) });

export const upsertPitch = (pitch: Partial<SavedPitch> & PitchDraft) => {
  if (pitch.id) return requestJson<SavedPitch>(`/api/assets/pitches/${encodeURIComponent(pitch.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pitch) });
  return requestJson<SavedPitch>('/api/assets/pitches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pitch) });
};
export const deletePitch = (id: string) => deleteAsset('pitches' as AssetType, id);


export type OcrStatus = 'none' | 'queued' | 'processing' | 'done' | 'failed' | 'manual' | 'manual_fallback';
export interface OcrResult { sourceFileId: string; sourceFileName?: string; status: OcrStatus; text: string; language?: string; confidence?: number; engine?: string; createdAt?: string; updatedAt?: string; error?: string; }
export interface OcrDesignType { id: string; label: string; targetType: AssetType; }
export const listOcrDesignTypes = () => requestJson<OcrDesignType[]>('/api/ocr/types');
export const getOcrResult = (fileId: string) => requestJson<OcrResult>(`/api/ocr/${encodeURIComponent(fileId)}`);
export const runOcr = (payload: { fileId: string; language?: string; preprocess?: string }) => requestJson<OcrResult>('/api/ocr/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const saveOcrText = (fileId: string, payload: { text: string; language?: string; status?: OcrStatus }) => requestJson<OcrResult>(`/api/ocr/${encodeURIComponent(fileId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const createOcrDraft = (payload: { fileId: string; text?: string; designType: string }) => requestJson<{ draft: IntakeDraft; targetType: AssetType; recognizedFields: Array<{ field: string; label: string; value: string }>; unrecognizedText: string; warnings: string[] }>('/api/ocr/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

export const exportArchive = () => requestJson<ArchiveExport>('/api/backup/export');
export const importArchive = (payload: ArchiveExport, mode: 'merge' | 'replace') =>
  requestJson<AssetBundle>('/api/backup/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, mode }) });

export type IntakeParserMode = 'Auto Detect' | 'Faction Sheet' | 'Character Sheet' | 'District Sheet' | 'POI Sheet' | 'Storyline Sheet' | 'Raw Text' | 'Image Evidence' | '图片 OCR' | 'OCR 文本建档' | 'Image OCR' | 'Existing Archive JSON' | 'Sheet' | 'raw_document';
export type IntakeDraftStatus = 'needs_review' | 'filed' | 'rejected' | 'merged' | 'reference_missing' | 'reference_merged';
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
  rowNumber?: number;
  sourceRowPreview?: Record<string, string>;
}
export interface IntakeParseResponse {
  file: UploadedFileRecord;
  parserMode: IntakeParserMode | string;
  status: 'parsed' | 'needs_review' | 'failed';
  message?: string;
  preview?: { kind: 'sheet'; sheetName?: string; headers: string[]; rows: string[][]; rowCount: number; guessedMapping: Record<string, string>; mapping?: Record<string, string> } | { kind: 'text'; text: string; chunks: Array<{ name: string; details: string }> } | { kind: 'json'; json: unknown };
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

export interface ImportHistoryRecord {
  id: string; createdAt: string; sourceFileId?: string; sourceFileName?: string; sourceFilePath?: string; parserMode?: string; targetType?: string; filedAssetIds: string[]; filedAssetNames: string[]; filedCount: number; backupFileName?: string; status: 'completed' | 'partially_completed' | 'failed' | 'reverted' | string; notes?: string; checkedAt?: string;
}
export interface BackupRecord { filename: string; createdAt: string; modifiedAt: string; size: number; contains: string[]; }
export const listImportHistory = () => requestJson<ImportHistoryRecord[]>('/api/import-history');
export const markImportChecked = (id: string, notes?: string) => requestJson<ImportHistoryRecord>(`/api/import-history/${encodeURIComponent(id)}/check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }) });
export const previewTestDataClean = (deleteUploads = false) => requestJson<{ byType: Record<string, Array<{ id: string; name: string }>>; drafts: Array<{ id: string; name: string; sourceFileName: string }>; uploads: string[]; counts: Record<string, number> }>(`/api/maintenance/test-data/preview?deleteUploads=${deleteUploads ? 'true' : 'false'}`);
export const cleanTestData = (deleteUploads = false) => requestJson<{ backup: { filename: string; path: string }; deleted: Record<string, number>; drafts: number; deletedUploadFiles: number; deleteUploads: boolean }>('/api/maintenance/test-data/clean', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deleteUploads }) });
export const listBackups = () => requestJson<BackupRecord[]>('/api/maintenance/backups');
export const previewBackup = (filename: string) => requestJson<{ filename: string; createdAt?: string; reason?: string; counts: Record<string, number> }>(`/api/maintenance/backups/${encodeURIComponent(filename)}`);
export const restoreBackup = (filename: string) => requestJson<{ restoredFrom: string; safetyBackup: { filename: string; path: string }; counts: Record<string, number> }>(`/api/maintenance/backups/${encodeURIComponent(filename)}/restore`, { method: 'POST' });
export const createMaintenanceBackup = (reason = 'manual-backup') => requestJson<{ filename: string; path: string }>('/api/maintenance/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
export const getDeleteImpact = (id: string, type?: string) => requestJson<{ asset: { id: string; name: string }; relatedCount: number; pitchCount: number; evidenceCount: number; draftCount: number }>(`/api/dossiers/${encodeURIComponent(id)}/delete-impact${type ? `?type=${encodeURIComponent(type)}` : ''}`);
export const safeDeleteDossier = (id: string, type?: string) => requestJson<{ deleted: AnyAsset; type: string; backup: { filename: string; path: string }; impact: Record<string, number>; cleaned: Record<string, number> }>(`/api/dossiers/${encodeURIComponent(id)}/delete-safe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) });
export const mergeDossiers = (payload: { sourceId?: string; sourceType?: string; sourceDraftId?: string; targetId: string; targetType?: string; summaryMode?: 'target' | 'source' | 'append'; detailsMode?: 'target' | 'source' | 'append'; previewOnly?: boolean }) => requestJson<{ preview: unknown; backup?: { filename: string; path: string }; merged?: AnyAsset; cleaned?: Record<string, number> }>('/api/dossiers/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const preflightIntake = (ids: string[]) => requestJson<{ draftCount: number; targets: Record<string, { fileName: string; existingCount: number; draftCount: number }>; duplicateCount: number; duplicateDraftIds: string[]; missingNameCount: number; evidenceBindings: number; backupPreview: string; hasSourceFileName: boolean; noNameDraftIds: string[]; severe: boolean }>('/api/intake/preflight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
export const cleanIntakeDrafts = (payload: { mode: 'rejected' | 'filed' | 'source' | 'projectx_test' | 'all'; sourceFileName?: string; withBackup?: boolean }) => requestJson<{ backup?: { filename: string; path: string }; removed: number; remaining: number }>('/api/intake/drafts/clean', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const fileIntakeDraftBatchSafe = (ids: string[], skipDuplicateIds?: string[]) => requestJson<{ backup: { filename: string; path: string }; filed: AnyAsset[]; history: ImportHistoryRecord }>('/api/intake/drafts/file-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, skipDuplicateIds }) });

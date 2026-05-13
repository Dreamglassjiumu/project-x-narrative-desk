import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assetFiles, backupsDir, dataDir, intakeDraftsPath, uploadFolders, uploadIndexPath, importHistoryPath } from './paths.js';
import { ensureJsonArrayFile, readJsonArray, writeJsonArray } from './jsonStore.js';

export const dossierTypes = ['factions', 'districts', 'pois', 'characters', 'storylines'];
export const allDataKeys = [...dossierTypes, 'pitches'];
const arrayRefFields = ['relatedFactionIds','relatedDistrictIds','relatedPoiIds','relatedCharacterIds','relatedStorylineIds','territoryDistrictIds','headquartersPoiIds','keyPoiIds','dominantFactions','relatedPlayableCharacters','relatedBosses'];
const scalarRefFields = ['factionId','districtId','primaryEvidenceId'];
const pitchLinkFields = ['linkedCharacterIds','linkedFactionIds','linkedDistrictIds','linkedPoiIds','linkedStorylineIds'];
const testNeedles = ['test character','test boss','projectx_test','测试角色','测试boss','测试 boss'];
const testFiles = ['projectx_test_characters.csv','projectx_test_characters.xlsx','projectx_test_story_fragments.md'];
const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
export const now = () => new Date().toISOString();
export const dataPath = (key) => path.join(dataDir, assetFiles[key]);
export const readDrafts = async () => { await ensureJsonArrayFile(intakeDraftsPath); return readJsonArray(intakeDraftsPath); };
export const writeDrafts = (drafts) => writeJsonArray(intakeDraftsPath, drafts);
export const readHistory = async () => { await ensureJsonArrayFile(importHistoryPath); return readJsonArray(importHistoryPath); };
export const writeHistory = (records) => writeJsonArray(importHistoryPath, records);
export const unique = (items) => [...new Set((items || []).filter(Boolean))];
export const createBackup = async (reason = 'manual') => {
  await fs.mkdir(backupsDir, { recursive: true });
  const payload = {};
  for (const key of allDataKeys) payload[key] = await readJsonArray(dataPath(key));
  payload.intakeDrafts = await readDrafts();
  payload.importHistory = await readHistory();
  const filename = `${reason}-${stamp()}.json`;
  const backupPath = path.join(backupsDir, filename);
  await fs.writeFile(backupPath, `${JSON.stringify({ createdAt: now(), reason, payload }, null, 2)}\n`, 'utf8');
  return { filename, path: backupPath };
};
export const readAllData = async () => {
  const data = {};
  for (const key of allDataKeys) data[key] = await readJsonArray(dataPath(key));
  data.intakeDrafts = await readDrafts();
  data.uploads = await readJsonArray(uploadIndexPath);
  data.importHistory = await readHistory();
  return data;
};
export const writeAllJsonData = async (data) => {
  for (const key of allDataKeys) if (Array.isArray(data[key])) await writeJsonArray(dataPath(key), data[key]);
  if (Array.isArray(data.intakeDrafts)) await writeDrafts(data.intakeDrafts);
  if (Array.isArray(data.importHistory)) await writeHistory(data.importHistory);
};
const textHasTestMarker = (value) => testNeedles.some((needle) => String(value || '').toLowerCase().includes(needle));
const fileHasTestMarker = (value) => testFiles.some((needle) => String(value || '').toLowerCase().includes(needle)) || String(value || '').toLowerCase().includes('projectx_test');
export const isTestAsset = (asset = {}) => {
  const nameBlob = [asset.name, asset.chineseName, asset.englishName, ...(asset.aliases || [])].join(' ');
  const sourceBlob = [asset.sourceFileName, ...(asset.sourceNotes || []), ...(asset.linkedFiles || [])].join(' ');
  return textHasTestMarker(nameBlob) || fileHasTestMarker(sourceBlob) || (asset.tags || []).map((x) => String(x).toLowerCase()).includes('test');
};
export const isTestDraft = (draft = {}) => fileHasTestMarker(draft.sourceFileName) || isTestAsset(draft.asset || {});
export const testUploadIds = async () => {
  const uploads = await readJsonArray(uploadIndexPath);
  return uploads.filter((u) => fileHasTestMarker(u.name) || fileHasTestMarker(u.filename) || (u.tags || []).map((x) => String(x).toLowerCase()).includes('test')).map((u) => u.id || u.filename);
};
export const testDataPreview = async ({ deleteUploads = false } = {}) => {
  const data = await readAllData();
  const byType = Object.fromEntries(dossierTypes.map((type) => [type, data[type].filter(isTestAsset).map(({ id, name }) => ({ id, name }))]));
  const drafts = data.intakeDrafts.filter(isTestDraft).map((d) => ({ id: d.id, name: d.asset?.name || d.sourceFileName, sourceFileName: d.sourceFileName }));
  const uploads = deleteUploads ? (await testUploadIds()) : [];
  return { byType, drafts, uploads, counts: Object.fromEntries([...dossierTypes.map((t) => [t, byType[t].length]), ['intakeDrafts', drafts.length], ['uploads', uploads.length]]) };
};
const countTouch = (set, key) => { if (key) set.add(key); };
export const cleanRefs = (record, sourceId, targetId) => {
  let changed = false;
  const next = { ...record };
  for (const field of arrayRefFields) if (Array.isArray(next[field])) {
    const mapped = next[field].map((id) => id === sourceId ? targetId : id).filter(Boolean);
    const cleaned = unique(mapped);
    if (cleaned.join('\u0000') !== next[field].join('\u0000')) { next[field] = cleaned; changed = true; }
  }
  for (const field of scalarRefFields) if (next[field] === sourceId) { next[field] = targetId || ''; changed = true; }
  return { record: next, changed };
};
export const deleteImpact = async (assetId) => {
  const data = await readAllData();
  const related = new Set(), pitches = new Set(), evidence = new Set(), drafts = new Set();
  for (const type of dossierTypes) for (const item of data[type]) {
    const hit = arrayRefFields.some((f) => (item[f] || []).includes(assetId)) || scalarRefFields.some((f) => item[f] === assetId);
    if (hit) related.add(item.id);
  }
  for (const p of data.pitches) if (pitchLinkFields.some((f) => (p[f] || []).includes(assetId))) pitches.add(p.id);
  for (const u of data.uploads) if ([...(u.linkedAssetIds || []), ...(u.primaryFor || []), ...(u.primaryAssetIds || [])].includes(assetId)) evidence.add(u.id || u.filename);
  for (const d of data.intakeDrafts) if (JSON.stringify(d).includes(assetId)) drafts.add(d.id);
  return { relatedCount: related.size, pitchCount: pitches.size, evidenceCount: evidence.size, draftCount: drafts.size };
};
export const replaceOrRemoveReferences = async (sourceId, targetId = '') => {
  const data = await readAllData(); const counts = { relatedDossiers: 0, pitches: 0, evidence: 0, drafts: 0 };
  for (const type of dossierTypes) data[type] = data[type].map((item) => { const { record, changed } = cleanRefs(item, sourceId, targetId); if (changed) counts.relatedDossiers += 1; return record; });
  data.pitches = data.pitches.map((pitch) => { let changed = false; const next = { ...pitch }; for (const f of pitchLinkFields) if (Array.isArray(next[f])) { const cleaned = unique(next[f].map((id) => id === sourceId ? targetId : id).filter(Boolean)); if (cleaned.join('\u0000') !== next[f].join('\u0000')) { next[f] = cleaned; changed = true; } } if (changed) counts.pitches += 1; return next; });
  data.uploads = data.uploads.map((upload) => { let changed = false; const next = { ...upload }; for (const f of ['linkedAssetIds','primaryFor','primaryAssetIds']) if (Array.isArray(next[f])) { const cleaned = unique(next[f].map((id) => id === sourceId ? targetId : id).filter(Boolean)); if (cleaned.join('\u0000') !== next[f].join('\u0000')) { next[f] = cleaned; changed = true; } } if (changed) counts.evidence += 1; return next; });
  data.intakeDrafts = data.intakeDrafts.map((draft) => { if (!JSON.stringify(draft).includes(sourceId)) return draft; counts.drafts += 1; return { ...draft, referenceStatus: targetId ? 'reference_merged' : 'reference_missing', updatedAt: now() }; });
  await writeAllJsonData(data); await writeJsonArray(uploadIndexPath, data.uploads);
  return counts;
};
export const addImportHistory = async (entry) => {
  const records = await readHistory();
  const record = { id: entry.id || `import-${crypto.randomUUID()}`, createdAt: entry.createdAt || now(), status: 'completed', notes: '', ...entry };
  await writeHistory([record, ...records]);
  return record;
};
export const backupSummary = (parsed) => {
  const payload = parsed?.payload || parsed;
  if (!payload || typeof payload !== 'object') throw new Error('备份结构不兼容。');
  return { factions: (payload.factions || []).length, districts: (payload.districts || []).length, pois: (payload.pois || []).length, characters: (payload.characters || []).length, storylines: (payload.storylines || []).length, pitches: (payload.pitches || []).length, intakeDrafts: (payload.intakeDrafts || []).length, importHistory: (payload.importHistory || []).length };
};
export const safeBackupName = (filename) => path.basename(String(filename || ''));
export const deleteUploadFiles = async (ids) => {
  const uploads = await readJsonArray(uploadIndexPath);
  let deleted = 0;
  for (const upload of uploads.filter((u) => ids.includes(u.id) || ids.includes(u.filename))) {
    const folders = upload.folder ? [upload.folder] : Object.keys(uploadFolders);
    for (const folder of folders) { try { await fs.unlink(path.join(uploadFolders[folder], upload.filename || upload.id)); deleted += 1; break; } catch (e) { if (e.code !== 'ENOENT') throw e; } }
  }
  await writeJsonArray(uploadIndexPath, uploads.filter((u) => !ids.includes(u.id) && !ids.includes(u.filename)));
  return deleted;
};

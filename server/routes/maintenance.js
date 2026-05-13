import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { backupsDir, dataDir, assetFiles } from '../utils/paths.js';
import { readJsonArray, writeJsonArray } from '../utils/jsonStore.js';
import { allDataKeys, backupSummary, createBackup, deleteUploadFiles, dossierTypes, isTestAsset, isTestDraft, readAllData, safeBackupName, testDataPreview, writeAllJsonData } from '../utils/maintenance.js';

const router = Router();
router.post('/backup', async (req, res, next) => { try { res.json(await createBackup(req.body?.reason || 'manual-backup')); } catch (error) { next(error); } });
router.get('/test-data/preview', async (req, res, next) => { try { res.json(await testDataPreview({ deleteUploads: req.query.deleteUploads === 'true' })); } catch (error) { next(error); } });
router.post('/test-data/clean', async (req, res, next) => {
  try {
    const deleteUploads = Boolean(req.body?.deleteUploads);
    const preview = await testDataPreview({ deleteUploads });
    const backup = await createBackup('backup-before-test-clean');
    const data = await readAllData();
    const deleted = {};
    for (const type of dossierTypes) { const before = data[type].length; data[type] = data[type].filter((asset) => !isTestAsset(asset)); deleted[type] = before - data[type].length; }
    const beforeDrafts = data.intakeDrafts.length; data.intakeDrafts = data.intakeDrafts.filter((draft) => !isTestDraft(draft));
    await writeAllJsonData(data);
    const deletedUploadFiles = deleteUploads ? await deleteUploadFiles(preview.uploads) : 0;
    res.json({ backup, deleted, drafts: beforeDrafts - data.intakeDrafts.length, deletedUploadFiles, deleteUploads });
  } catch (error) { next(error); }
});
router.get('/backups', async (_req, res, next) => {
  try {
    await fs.mkdir(backupsDir, { recursive: true });
    const files = await fs.readdir(backupsDir, { withFileTypes: true });
    const records = await Promise.all(files.filter((f) => f.isFile() && f.name.endsWith('.json')).map(async (f) => {
      const stat = await fs.stat(path.join(backupsDir, f.name));
      let contains = [];
      try { const parsed = JSON.parse(await fs.readFile(path.join(backupsDir, f.name), 'utf8')); contains = Object.keys(parsed.payload || parsed).filter((key) => Array.isArray((parsed.payload || parsed)[key])); } catch { contains = ['无法读取']; }
      return { filename: f.name, createdAt: stat.birthtime.toISOString(), modifiedAt: stat.mtime.toISOString(), size: stat.size, contains };
    }));
    res.json(records.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)));
  } catch (error) { next(error); }
});
router.get('/backups/:filename', async (req, res, next) => {
  try { const filename = safeBackupName(req.params.filename); const raw = await fs.readFile(path.join(backupsDir, filename), 'utf8'); const parsed = JSON.parse(raw); res.json({ filename, createdAt: parsed.createdAt, reason: parsed.reason, counts: backupSummary(parsed) }); }
  catch (error) { if (error.code === 'ENOENT') return res.status(404).json({ error: 'Backup not found.' }); next(error); }
});
router.post('/backups/:filename/restore', async (req, res, next) => {
  try {
    const filename = safeBackupName(req.params.filename); const parsed = JSON.parse(await fs.readFile(path.join(backupsDir, filename), 'utf8')); const payload = parsed.payload || parsed; backupSummary(payload);
    const backup = await createBackup('backup-before-restore');
    const allowed = {}; for (const key of [...allDataKeys, 'intakeDrafts', 'importHistory']) allowed[key] = Array.isArray(payload[key]) ? payload[key] : [];
    await writeAllJsonData(allowed);
    res.json({ restoredFrom: filename, safetyBackup: backup, counts: backupSummary(payload) });
  } catch (error) { next(error); }
});
export default router;

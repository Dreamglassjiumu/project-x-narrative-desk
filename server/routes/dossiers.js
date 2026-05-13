import path from 'node:path';
import { Router } from 'express';
import { assetFiles, dataDir, uploadIndexPath } from '../utils/paths.js';
import { readJsonArray, writeJsonArray } from '../utils/jsonStore.js';
import { createBackup, deleteImpact, dossierTypes, replaceOrRemoveReferences, unique, readAllData, writeAllJsonData, now } from '../utils/maintenance.js';
const router = Router();
const findAsset = async (id, hintedType) => { const types = hintedType ? [hintedType] : dossierTypes; for (const type of types) { const records = await readJsonArray(path.join(dataDir, assetFiles[type])); const asset = records.find((r) => r.id === id); if (asset) return { type, asset, records }; } return null; };
router.get('/:id/delete-impact', async (req, res, next) => { try { const found = await findAsset(req.params.id, req.query.type); if (!found) return res.status(404).json({ error: 'Dossier not found.' }); res.json({ asset: { id: found.asset.id, name: found.asset.name }, ...(await deleteImpact(req.params.id)) }); } catch (error) { next(error); } });
router.post('/:id/delete-safe', async (req, res, next) => { try { const found = await findAsset(req.params.id, req.body?.type); if (!found) return res.status(404).json({ error: 'Dossier not found.' }); const impact = await deleteImpact(req.params.id); const backup = await createBackup('backup-before-safe-delete'); const nextRecords = found.records.filter((r) => r.id !== req.params.id); await writeJsonArray(path.join(dataDir, assetFiles[found.type]), nextRecords); const cleaned = await replaceOrRemoveReferences(req.params.id); res.json({ deleted: found.asset, type: found.type, backup, impact, cleaned }); } catch (error) { next(error); } });
const mergeText = (target, source, mode) => mode === 'source' ? source : mode === 'append' ? [target, source].filter(Boolean).join('\n\n--- merged source ---\n\n') : target;
const mergeAsset = (target, source, options = {}) => { const out = { ...target }; for (const f of ['name','chineseName','englishName']) if (!out[f] && source[f]) out[f] = source[f]; for (const f of ['summary','details']) out[f] = mergeText(out[f] || '', source[f] || '', options[`${f}Mode`] || 'target'); for (const f of ['tags','aliases','sourceNotes','narrativeConstraints','doNotRevealYet','relatedFactionIds','relatedDistrictIds','relatedPoiIds','relatedCharacterIds','relatedStorylineIds','territoryDistrictIds','headquartersPoiIds','keyPoiIds']) out[f] = unique([...(out[f] || []), ...(source[f] || [])]); if (!out.primaryEvidenceId && source.primaryEvidenceId) out.primaryEvidenceId = source.primaryEvidenceId; return out; };

router.post('/merge', async (req, res, next) => {
  try {
    const { sourceId, sourceType, targetId, targetType, sourceDraftId, summaryMode = 'target', detailsMode = 'target' } = req.body || {};
    if (!targetId) return res.status(400).json({ error: 'Missing targetId.' });
    const data = await readAllData();
    let actualTargetType = targetType;
    let target = (data[targetType] || []).find((a) => a.id === targetId);
    if (!target) for (const t of dossierTypes) { target = data[t].find((a) => a.id === targetId); if (target) { actualTargetType = t; break; } }
    if (!target) return res.status(404).json({ error: 'Merge target not found.' });

    let source, actualSourceType = sourceType, sourceDraft;
    if (sourceDraftId) {
      sourceDraft = data.intakeDrafts.find((d) => d.id === sourceDraftId);
      if (!sourceDraft) return res.status(404).json({ error: 'Source draft not found.' });
      source = sourceDraft.asset; actualSourceType = sourceDraft.targetType;
    } else {
      for (const t of (sourceType ? [sourceType] : dossierTypes)) { source = data[t].find((a) => a.id === sourceId); if (source) { actualSourceType = t; break; } }
    }
    if (!source) return res.status(404).json({ error: 'Merge source not found.' });
    const preview = { source: { id: sourceId || sourceDraftId, name: source.name, type: actualSourceType }, target: { id: targetId, name: target.name, type: actualTargetType }, summaryConflict: Boolean(target.summary && source.summary), detailsConflict: Boolean(target.details && source.details) };
    if (req.query.preview === 'true' || req.body?.previewOnly) return res.json(preview);
    const backup = await createBackup('backup-before-merge');
    const merged = mergeAsset(target, source, { summaryMode, detailsMode });
    data[actualTargetType] = data[actualTargetType].map((a) => a.id === targetId ? merged : a);
    if (sourceDraftId) {
      data.intakeDrafts = data.intakeDrafts.map((d) => d.id === sourceDraftId ? { ...d, status: 'merged', filedAssetId: targetId, updatedAt: now() } : d);
      data.uploads = data.uploads.map((upload) => (upload.id === sourceDraft.sourceFileId || upload.filename === sourceDraft.sourceFileId) ? { ...upload, linkedAssetIds: unique([...(upload.linkedAssetIds || []), targetId]) } : upload);
      await writeAllJsonData(data); await writeJsonArray(uploadIndexPath, data.uploads);
      return res.json({ preview, backup, merged, cleaned: {} });
    }
    data[actualSourceType] = data[actualSourceType].filter((a) => a.id !== sourceId);
    await writeAllJsonData(data);
    const cleaned = await replaceOrRemoveReferences(sourceId, targetId);
    res.json({ preview, backup, merged, cleaned });
  } catch (error) { next(error); }
});
export default router;

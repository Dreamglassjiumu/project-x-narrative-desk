import path from 'node:path';
import { Router } from 'express';
import { assetFiles, dataDir } from '../utils/paths.js';
import { readJsonArray, writeJsonArray } from '../utils/jsonStore.js';

const router = Router();
const keys = ['factions', 'districts', 'pois', 'characters', 'storylines', 'pitches'];
const filePath = (key) => path.join(dataDir, assetFiles[key]);

router.get('/export', async (_req, res, next) => {
  try {
    const payload = { exportedAt: new Date().toISOString(), version: '0.2' };
    for (const key of keys) payload[key] = await readJsonArray(filePath(key));
    res.json(payload);
  } catch (error) { next(error); }
});

router.post('/import', async (req, res, next) => {
  try {
    const { payload, mode } = req.body ?? {};
    if (!payload || !['merge', 'replace'].includes(mode)) return res.status(400).json({ error: 'Invalid archive import payload or mode' });
    const result = {};
    for (const key of keys) {
      const incoming = Array.isArray(payload[key]) ? payload[key] : [];
      if (mode === 'replace') {
        await writeJsonArray(filePath(key), incoming);
        result[key] = incoming;
      } else {
        const existing = await readJsonArray(filePath(key));
        const merged = new Map(existing.map((record) => [record.id, record]));
        for (const record of incoming) merged.set(record.id, { ...merged.get(record.id), ...record });
        const records = [...merged.values()];
        await writeJsonArray(filePath(key), records);
        result[key] = records;
      }
    }
    res.json(result);
  } catch (error) { next(error); }
});
export default router;

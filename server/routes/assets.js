import crypto from 'node:crypto';
import path from 'node:path';
import { Router } from 'express';
import { assetFiles, dataDir } from '../utils/paths.js';
import { readJsonArray, writeJsonArray } from '../utils/jsonStore.js';

const router = Router();

const getAssetPath = (type) => {
  const fileName = assetFiles[type];
  return fileName ? path.join(dataDir, fileName) : undefined;
};

const idPrefixes = { factions: 'faction', districts: 'district', pois: 'poi', characters: 'char', storylines: 'story', pitches: 'pitch' };

const normalizeId = (value, prefix = 'asset') => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `${prefix}-${crypto.randomUUID()}`;
};

router.get('/', async (_req, res, next) => {
  try {
    const entries = await Promise.all(
      Object.entries(assetFiles).map(async ([type, fileName]) => [type, await readJsonArray(path.join(dataDir, fileName))]),
    );
    res.json(Object.fromEntries(entries));
  } catch (error) {
    next(error);
  }
});

router.get('/:type', async (req, res, next) => {
  try {
    const filePath = getAssetPath(req.params.type);
    if (!filePath) return res.status(404).json({ error: `Unknown asset type: ${req.params.type}` });
    res.json(await readJsonArray(filePath));
  } catch (error) {
    next(error);
  }
});

router.post('/:type', async (req, res, next) => {
  try {
    const filePath = getAssetPath(req.params.type);
    if (!filePath) return res.status(404).json({ error: `Unknown asset type: ${req.params.type}` });
    const records = await readJsonArray(filePath);
    const record = { ...req.body, id: normalizeId(req.body?.id, idPrefixes[req.params.type] ?? 'asset') };
    if (records.some((item) => item.id === record.id)) {
      return res.status(409).json({ error: `Asset already exists: ${record.id}` });
    }
    records.unshift(record);
    await writeJsonArray(filePath, records);
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

router.put('/:type/:id', async (req, res, next) => {
  try {
    const filePath = getAssetPath(req.params.type);
    if (!filePath) return res.status(404).json({ error: `Unknown asset type: ${req.params.type}` });
    const records = await readJsonArray(filePath);
    const index = records.findIndex((item) => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: `Asset not found: ${req.params.id}` });
    records[index] = { ...records[index], ...req.body, id: req.params.id };
    await writeJsonArray(filePath, records);
    res.json(records[index]);
  } catch (error) {
    next(error);
  }
});

router.delete('/:type/:id', async (req, res, next) => {
  try {
    const filePath = getAssetPath(req.params.type);
    if (!filePath) return res.status(404).json({ error: `Unknown asset type: ${req.params.type}` });
    const records = await readJsonArray(filePath);
    const nextRecords = records.filter((item) => item.id !== req.params.id);
    if (nextRecords.length === records.length) return res.status(404).json({ error: `Asset not found: ${req.params.id}` });
    await writeJsonArray(filePath, nextRecords);
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

export default router;

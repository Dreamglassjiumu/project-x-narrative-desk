import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const uploadsDir = path.join(rootDir, 'uploads');
const uploadIndexPath = path.join(uploadsDir, '.index.json');
const PORT = Number(process.env.PORT ?? 4317);
const HOST = '127.0.0.1';

const assetFiles = {
  factions: 'factions.json',
  districts: 'districts.json',
  pois: 'pois.json',
  characters: 'characters.json',
  storylines: 'storylines.json',
  pitches: 'pitches.json',
};

const ensureWorkspace = async () => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  await Promise.all(Object.values(assetFiles).map(async (fileName) => {
    const filePath = path.join(dataDir, fileName);
    if (!existsSync(filePath)) {
      await fs.writeFile(filePath, '[]\n', 'utf8');
    }
  }));
  if (!existsSync(uploadIndexPath)) {
    await fs.writeFile(uploadIndexPath, '[]\n', 'utf8');
  }
};

const readJsonArray = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = raw.trim() ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

const writeJsonArray = async (filePath, records) => {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
};

const getAssetPath = (type) => {
  const fileName = assetFiles[type];
  return fileName ? path.join(dataDir, fileName) : undefined;
};

const normalizeId = (value, prefix = 'asset') => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `${prefix}-${crypto.randomUUID()}`;
};

const safeOriginalName = (name) => path.basename(name).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 160) || 'upload.bin';

await ensureWorkspace();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}-${safeOriginalName(file.originalname)}`),
});
const upload = multer({ storage });

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.options('*', (_req, res) => res.sendStatus(204));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: 'local-first', dataDir, uploadsDir });
});

app.get('/api/assets', async (_req, res, next) => {
  try {
    const entries = await Promise.all(Object.entries(assetFiles).map(async ([type, fileName]) => [type, await readJsonArray(path.join(dataDir, fileName))]));
    res.json(Object.fromEntries(entries));
  } catch (error) {
    next(error);
  }
});

app.post('/api/assets/:type', async (req, res, next) => {
  try {
    const filePath = getAssetPath(req.params.type);
    if (!filePath) return res.status(404).json({ error: `Unknown asset type: ${req.params.type}` });
    const records = await readJsonArray(filePath);
    const record = { ...req.body, id: normalizeId(req.body?.id, req.params.type.slice(0, -1) || 'asset') };
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

app.put('/api/assets/:type/:id', async (req, res, next) => {
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

app.delete('/api/assets/:type/:id', async (req, res, next) => {
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

const readUploadIndex = () => readJsonArray(uploadIndexPath);
const writeUploadIndex = (records) => writeJsonArray(uploadIndexPath, records);

app.post('/api/uploads', upload.array('files'), async (req, res, next) => {
  try {
    const files = req.files ?? [];
    const index = await readUploadIndex();
    const records = files.map((file) => ({
      id: file.filename,
      name: file.originalname,
      filename: file.filename,
      type: file.mimetype || 'application/octet-stream',
      size: file.size,
      addedAt: new Date().toISOString(),
      url: `/uploads/${encodeURIComponent(file.filename)}`,
    }));
    await writeUploadIndex([...records, ...index]);
    res.status(201).json(records);
  } catch (error) {
    next(error);
  }
});

app.get('/api/uploads', async (_req, res, next) => {
  try {
    const index = await readUploadIndex();
    const files = await fs.readdir(uploadsDir, { withFileTypes: true });
    const visibleFiles = new Map(files.filter((file) => file.isFile() && !file.name.startsWith('.')).map((file) => [file.name, file]));
    const indexed = [];
    for (const record of index) {
      if (!visibleFiles.has(record.filename)) continue;
      const stat = await fs.stat(path.join(uploadsDir, record.filename));
      indexed.push({ ...record, size: stat.size });
      visibleFiles.delete(record.filename);
    }
    const orphaned = await Promise.all([...visibleFiles.keys()].map(async (filename) => {
      const stat = await fs.stat(path.join(uploadsDir, filename));
      return {
        id: filename,
        name: filename,
        filename,
        type: 'application/octet-stream',
        size: stat.size,
        addedAt: stat.birthtime.toISOString(),
        url: `/uploads/${encodeURIComponent(filename)}`,
      };
    }));
    res.json([...indexed, ...orphaned].sort((a, b) => b.addedAt.localeCompare(a.addedAt)));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/uploads/:id', async (req, res, next) => {
  try {
    const id = path.basename(req.params.id);
    const filePath = path.join(uploadsDir, id);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const index = await readUploadIndex();
    await writeUploadIndex(index.filter((record) => record.id !== id && record.filename !== id));
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.get('/uploads/:id', (req, res, next) => {
  const id = path.basename(req.params.id);
  const filePath = path.join(uploadsDir, id);
  if (!existsSync(filePath)) return res.sendStatus(404);
  createReadStream(filePath).on('error', next).pipe(res);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message ?? 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Project:X local API listening at http://localhost:${PORT}`);
  console.log(`Data directory: ${dataDir}`);
  console.log(`Uploads directory: ${uploadsDir}`);
});

import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { Router } from 'express';
import { documentsDir, imagesDir, uploadFolders, uploadIndexPath } from '../utils/paths.js';
import { readJsonArray, writeJsonArray } from '../utils/jsonStore.js';

const router = Router();

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.md', '.markdown', '.json', '.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

const safeOriginalName = (name) => path.basename(name).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 160) || 'upload.bin';
const fileFolder = (fileName) => (imageExtensions.has(path.extname(fileName).toLowerCase()) ? 'images' : 'documents');
const readUploadIndex = () => readJsonArray(uploadIndexPath);
const writeUploadIndex = (records) => writeJsonArray(uploadIndexPath, records);

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const originalName = safeOriginalName(file.originalname);
    cb(null, fileFolder(originalName) === 'images' ? imagesDir : documentsDir);
  },
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}-${safeOriginalName(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.has(extension)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${extension || file.originalname}`));
  },
});

const toRecord = (file, stat) => {
  const folder = fileFolder(file.filename);
  return {
    id: file.filename,
    name: file.originalname,
    filename: file.filename,
    folder,
    type: file.mimetype || 'application/octet-stream',
    size: stat?.size ?? file.size,
    addedAt: (stat?.birthtime ?? new Date()).toISOString(),
    url: `/uploads/${folder}/${encodeURIComponent(file.filename)}`,
  };
};

router.post('/', upload.array('files'), async (req, res, next) => {
  try {
    const files = req.files ?? [];
    const index = await readUploadIndex();
    const records = await Promise.all(files.map(async (file) => toRecord(file, await fs.stat(file.path))));
    await writeUploadIndex([...records, ...index]);
    res.status(201).json(records);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const index = await readUploadIndex();
    const visibleFiles = new Map();

    for (const [folder, folderPath] of Object.entries(uploadFolders)) {
      const files = await fs.readdir(folderPath, { withFileTypes: true });
      files.filter((file) => file.isFile()).forEach((file) => visibleFiles.set(file.name, { folder, folderPath }));
    }

    const indexed = [];
    for (const record of index) {
      const location = visibleFiles.get(record.filename);
      if (!location) continue;
      const stat = await fs.stat(path.join(location.folderPath, record.filename));
      indexed.push({ ...record, folder: location.folder, size: stat.size, url: `/uploads/${location.folder}/${encodeURIComponent(record.filename)}` });
      visibleFiles.delete(record.filename);
    }

    const orphaned = await Promise.all(
      [...visibleFiles.entries()].map(async ([filename, location]) => {
        const stat = await fs.stat(path.join(location.folderPath, filename));
        return {
          id: filename,
          name: filename,
          filename,
          folder: location.folder,
          type: 'application/octet-stream',
          size: stat.size,
          addedAt: stat.birthtime.toISOString(),
          url: `/uploads/${location.folder}/${encodeURIComponent(filename)}`,
        };
      }),
    );

    res.json([...indexed, ...orphaned].sort((a, b) => b.addedAt.localeCompare(a.addedAt)));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = path.basename(req.params.id);
    const index = await readUploadIndex();
    const indexedRecord = index.find((record) => record.id === id || record.filename === id);
    const candidateFolders = indexedRecord?.folder ? [indexedRecord.folder] : ['images', 'documents'];

    for (const folder of candidateFolders) {
      const folderPath = uploadFolders[folder];
      if (!folderPath) continue;
      try {
        await fs.unlink(path.join(folderPath, id));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    await writeUploadIndex(index.filter((record) => record.id !== id && record.filename !== id));
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

router.get('/file/:folder/:id', (req, res, next) => {
  const folderPath = uploadFolders[req.params.folder];
  if (!folderPath) return res.sendStatus(404);
  const id = path.basename(req.params.id);
  const filePath = path.join(folderPath, id);
  if (!existsSync(filePath)) return res.sendStatus(404);
  createReadStream(filePath).on('error', next).pipe(res);
});

export const streamUploadedFile = (req, res, next) => {
  const folderPath = uploadFolders[req.params.folder];
  if (!folderPath) return res.sendStatus(404);
  const id = path.basename(req.params.id);
  const filePath = path.join(folderPath, id);
  if (!existsSync(filePath)) return res.sendStatus(404);
  createReadStream(filePath).on('error', next).pipe(res);
};

export default router;

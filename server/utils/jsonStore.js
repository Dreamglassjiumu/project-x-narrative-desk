import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { assetFiles, backupsDir, dataDir, documentsDir, imagesDir, intakeDraftsPath, uploadIndexPath, uploadsDir } from './paths.js';

export const ensureWorkspace = async () => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(imagesDir, { recursive: true });
  await fs.mkdir(documentsDir, { recursive: true });
  await fs.mkdir(backupsDir, { recursive: true });

  await Promise.all(
    Object.values(assetFiles).map(async (fileName) => {
      const filePath = path.join(dataDir, fileName);
      if (!existsSync(filePath)) {
        await fs.writeFile(filePath, '[]\n', 'utf8');
      }
    }),
  );

  if (!existsSync(uploadIndexPath)) {
    await fs.writeFile(uploadIndexPath, '[]\n', 'utf8');
  }

  if (!existsSync(intakeDraftsPath)) {
    await fs.writeFile(intakeDraftsPath, '[]\n', 'utf8');
  }
};

export const ensureJsonArrayFile = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (!existsSync(filePath)) {
    await fs.writeFile(filePath, '[]\n', 'utf8');
  }
};

export const readJsonArray = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = raw.trim() ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      await ensureJsonArrayFile(filePath);
      return [];
    }
    throw error;
  }
};

export const writeJsonArray = async (filePath, records) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
};

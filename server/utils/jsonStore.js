import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { assetFiles, dataDir, documentsDir, imagesDir, uploadIndexPath, uploadsDir } from './paths.js';

export const ensureWorkspace = async () => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(imagesDir, { recursive: true });
  await fs.mkdir(documentsDir, { recursive: true });

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
};

export const readJsonArray = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = raw.trim() ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

export const writeJsonArray = async (filePath, records) => {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
};

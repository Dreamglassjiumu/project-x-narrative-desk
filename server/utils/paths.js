import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, '../..');
export const dataDir = path.join(rootDir, 'data');
export const uploadsDir = path.join(rootDir, 'uploads');
export const imagesDir = path.join(uploadsDir, 'images');
export const documentsDir = path.join(uploadsDir, 'documents');
export const uploadIndexPath = path.join(uploadsDir, '.index.json');
export const intakeDraftsPath = path.join(dataDir, 'intake-drafts.json');
export const backupsDir = path.join(dataDir, 'backups');

export const assetFiles = {
  factions: 'factions.json',
  districts: 'districts.json',
  pois: 'pois.json',
  characters: 'characters.json',
  storylines: 'storylines.json',
  pitches: 'pitches.json',
};

export const uploadFolders = {
  images: imagesDir,
  documents: documentsDir,
};

export const importHistoryPath = path.join(dataDir, 'import-history.json');

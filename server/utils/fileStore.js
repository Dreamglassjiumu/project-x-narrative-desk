import { uploadIndexPath } from './paths.js';
import { readJsonArray, writeJsonArray } from './jsonStore.js';

export const readUploadIndex = () => readJsonArray(uploadIndexPath);
export const writeUploadIndex = (records) => writeJsonArray(uploadIndexPath, records);

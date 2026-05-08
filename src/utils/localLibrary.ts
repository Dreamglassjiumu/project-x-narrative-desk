export interface LocalLibraryFile {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: string;
}

export const createLocalLibraryFile = (file: File): LocalLibraryFile => ({
  id: crypto.randomUUID(),
  name: file.name,
  type: file.type || 'unknown',
  size: file.size,
  addedAt: new Date().toISOString(),
});

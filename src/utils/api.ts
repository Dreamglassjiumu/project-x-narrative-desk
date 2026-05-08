import type { AnyAsset, Character, District, Faction, Poi, Storyline } from '../data/types';
import type { PitchDraft } from './pitch';

export interface AssetBundle {
  factions: Faction[];
  districts: District[];
  pois: Poi[];
  characters: Character[];
  storylines: Storyline[];
  pitches: PitchDraft[];
}

export interface UploadedFileRecord {
  id: string;
  name: string;
  filename: string;
  type: string;
  size: number;
  addedAt: string;
  url: string;
}

export const emptyAssetBundle: AssetBundle = {
  factions: [],
  districts: [],
  pois: [],
  characters: [],
  storylines: [],
  pitches: [],
};

const requestJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
};

export const fetchAssetBundle = () => requestJson<AssetBundle>('/api/assets');

export const flattenAssets = (bundle: AssetBundle): AnyAsset[] => [
  ...bundle.factions,
  ...bundle.districts,
  ...bundle.pois,
  ...bundle.characters,
  ...bundle.storylines,
];

export const listUploads = () => requestJson<UploadedFileRecord[]>('/api/uploads');

export const uploadFiles = async (files: FileList | File[]) => {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append('files', file));
  return requestJson<UploadedFileRecord[]>('/api/uploads', { method: 'POST', body: formData });
};

export const deleteUpload = async (id: string) => {
  const response = await fetch(`/api/uploads/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  }
};

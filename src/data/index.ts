import { characters } from './characters';
import { districts } from './districts';
import { factions } from './factions';
import { pois } from './pois';
import { storylines } from './storylines';
import type { AnyAsset } from './types';

export { characters, districts, factions, pois, storylines };
export type * from './types';

export const allAssets: AnyAsset[] = [
  ...factions,
  ...districts,
  ...pois,
  ...characters,
  ...storylines,
];

export const assetById = new Map(allAssets.map((asset) => [asset.id, asset]));

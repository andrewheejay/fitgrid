import type { DeckPools } from './deck';
import type { Item, ItemId } from './items';
import { LAYERS, type Layer } from './layers';

export type OutfitId = string;

export interface Outfit {
  id: OutfitId;
  /** Human-named. New ones start "Untitled fit". */
  name: string;
  /** ISO 8601. */
  date: string;
  top: ItemId;
  /** null means no outer layer — the sentinel is not part of the data model. */
  outer: ItemId | null;
  bottom: ItemId;
  shoes: ItemId;
}

/**
 * The synthesised "no outer layer" option. It exists only inside the deck's
 * outer rail so you can cycle to it; it is never an Item, never appears in the
 * wardrobe grid, and never counts towards anything.
 */
export const NO_OUTER = '__no_outer__' as const;
export const NO_OUTER_NAME = 'No outer layer';
export const NO_OUTER_META = 'Skipped for today';

export function isNoOuter(id: ItemId | null | undefined): boolean {
  return id === NO_OUTER || id === null || id === undefined;
}

/**
 * Build the deck's pools from the wardrobe. The sentinel sits first in the
 * outer pool, matching the prototype, which makes a four-jacket wardrobe a pool
 * of exactly five — rendered whole, not windowed.
 */
export function poolsFrom(items: readonly Item[]): DeckPools {
  const byLayer = (layer: Layer): ItemId[] =>
    items.filter((item) => item.category === layer).map((item) => item.id);

  return {
    top: byLayer('top'),
    outer: [NO_OUTER, ...byLayer('outer')],
    bottom: byLayer('bottom'),
    shoes: byLayer('shoes'),
  };
}

/** Iterate a fit in LAYERS order, which is the order every view renders it in. */
export function layersOf(outfit: Outfit): Array<{ layer: Layer; itemId: ItemId | null }> {
  return LAYERS.map((layer) => ({ layer, itemId: outfit[layer] }));
}

export function outfitFromSelection(
  ids: Record<Layer, ItemId | undefined>,
  meta: { id: OutfitId; name: string; date: string },
): Outfit | null {
  // A fit needs every required layer. Outerwear is the only optional one.
  if (!ids.top || !ids.bottom || !ids.shoes) return null;
  return {
    ...meta,
    top: ids.top,
    outer: isNoOuter(ids.outer) ? null : (ids.outer ?? null),
    bottom: ids.bottom,
    shoes: ids.shoes,
  };
}

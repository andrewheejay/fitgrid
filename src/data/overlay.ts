import type { Item, ItemId } from '~/domain/items';
import type { Outfit, OutfitId } from '~/domain/outfits';
import { SEED_ITEMS } from './seed/items';
import { SEED_OUTFITS } from './seed/outfits';

/**
 * What the visitor has changed, layered over the committed seed wardrobe.
 *
 * The seed lives in the bundle and cannot be edited, so removals are recorded
 * as tombstones rather than deletions.
 */
export interface Overlay {
  addedItems: Item[];
  removedItemIds: ItemId[];
  savedOutfits: Outfit[];
  removedOutfitIds: OutfitId[];
}

export function emptyOverlay(): Overlay {
  return { addedItems: [], removedItemIds: [], savedOutfits: [], removedOutfitIds: [] };
}

/** Newest additions first, then the seed wardrobe. */
export function mergeItems(overlay: Overlay): Item[] {
  const removed = new Set(overlay.removedItemIds);
  return [...overlay.addedItems, ...SEED_ITEMS].filter((item) => !removed.has(item.id));
}

/** Saved fits are prepended, so the most recent sits first. */
export function mergeOutfits(overlay: Overlay): Outfit[] {
  const removed = new Set(overlay.removedOutfitIds);
  return [...overlay.savedOutfits, ...SEED_OUTFITS].filter((fit) => !removed.has(fit.id));
}

/**
 * A fit that references a removed item can no longer be rendered. Rather than
 * showing a hole, drop it from the list.
 */
export function outfitsWithAllItems(outfits: readonly Outfit[], items: readonly Item[]): Outfit[] {
  const present = new Set(items.map((item) => item.id));
  return outfits.filter(
    (fit) =>
      present.has(fit.top) &&
      present.has(fit.bottom) &&
      present.has(fit.shoes) &&
      (fit.outer === null || present.has(fit.outer)),
  );
}

import { applyItemPatch, type Item, type ItemId, type ItemPatch } from '~/domain/items';
import type { Outfit, OutfitId } from '~/domain/outfits';
import { SEED_ITEMS } from './seed/items';
import { SEED_OUTFITS } from './seed/outfits';

/**
 * What the visitor has changed, layered over the committed seed wardrobe.
 *
 * The seed lives in the bundle and cannot be edited, so removals are recorded
 * as tombstones and hand corrections as patches, rather than as writes.
 */
export interface Overlay {
  addedItems: Item[];
  removedItemIds: ItemId[];
  /** Hand corrections, by item id. Applies to seed and added items alike. */
  itemEdits: Record<ItemId, ItemPatch>;
  /** The only field of a fit anyone renames. */
  outfitNames: Record<OutfitId, string>;
  savedOutfits: Outfit[];
}

export function emptyOverlay(): Overlay {
  return {
    addedItems: [],
    removedItemIds: [],
    itemEdits: {},
    outfitNames: {},
    savedOutfits: [],
  };
}

/** Newest additions first, then the seed wardrobe, each with its edits applied. */
export function mergeItems(overlay: Overlay): Item[] {
  const removed = new Set(overlay.removedItemIds);
  return [...overlay.addedItems, ...SEED_ITEMS]
    .filter((item) => !removed.has(item.id))
    .map((item) => applyItemPatch(item, overlay.itemEdits[item.id]));
}

/** Saved fits are prepended, so the most recent sits first. */
export function mergeOutfits(overlay: Overlay): Outfit[] {
  return [...overlay.savedOutfits, ...SEED_OUTFITS].map((fit) => {
    const renamed = overlay.outfitNames[fit.id];
    return renamed === undefined ? fit : { ...fit, name: renamed };
  });
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

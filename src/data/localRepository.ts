import { emptyOverlay, type Overlay } from './overlay';
import type { WardrobeRepository } from './repository';

const KEY = 'fitgrid.overlay.v1';

/**
 * localStorage is not guaranteed: private windows, cleared site data and
 * browsers set to block storage all throw on access. Every read and write is
 * guarded, and a failure degrades to the seed wardrobe rather than a blank page.
 */
export function createLocalRepository(): WardrobeRepository {
  return {
    load() {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return emptyOverlay();
        const parsed = JSON.parse(raw) as Partial<Overlay>;
        // Every field is defaulted rather than trusted: an overlay written by
        // a build that predates hand edits has no `itemEdits`, and reading it
        // back as `undefined` would fault on the first lookup.
        return {
          addedItems: parsed.addedItems ?? [],
          removedItemIds: parsed.removedItemIds ?? [],
          itemEdits: parsed.itemEdits ?? {},
          outfitNames: parsed.outfitNames ?? {},
          savedOutfits: parsed.savedOutfits ?? [],
        };
      } catch {
        return emptyOverlay();
      }
    },
    save(overlay) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(overlay));
      } catch {
        // Nothing to do — the session still works, it just will not survive.
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(KEY);
      } catch {
        // Same.
      }
    },
  };
}

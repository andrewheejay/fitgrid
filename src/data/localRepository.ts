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
        return {
          addedItems: parsed.addedItems ?? [],
          removedItemIds: parsed.removedItemIds ?? [],
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

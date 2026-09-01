import { create } from 'zustand';
import { createLocalRepository } from '~/data/localRepository';
import {
  emptyOverlay,
  mergeItems,
  mergeOutfits,
  outfitsWithAllItems,
  type Overlay,
} from '~/data/overlay';
import type { WardrobeRepository } from '~/data/repository';
import type { Item, ItemId } from '~/domain/items';
import type { Outfit } from '~/domain/outfits';

interface WardrobeState {
  overlay: Overlay;
  items: Item[];
  outfits: Outfit[];
  addItem: (item: Item) => void;
  removeItem: (id: ItemId) => void;
  saveOutfit: (outfit: Outfit) => void;
  reset: () => void;
}

/**
 * Derived views are recomputed on every write rather than stored, so the
 * merge rules live in exactly one place and no caller can read a stale list.
 */
function derive(overlay: Overlay): Pick<WardrobeState, 'overlay' | 'items' | 'outfits'> {
  const items = mergeItems(overlay);
  return { overlay, items, outfits: outfitsWithAllItems(mergeOutfits(overlay), items) };
}

export function createWardrobeStore(repository: WardrobeRepository) {
  return create<WardrobeState>((set, get) => {
    const commit = (overlay: Overlay) => {
      repository.save(overlay);
      set(derive(overlay));
    };

    return {
      ...derive(repository.load()),

      addItem: (item) => {
        const { overlay } = get();
        commit({ ...overlay, addedItems: [item, ...overlay.addedItems] });
      },

      removeItem: (id) => {
        const { overlay } = get();
        commit({
          ...overlay,
          addedItems: overlay.addedItems.filter((item) => item.id !== id),
          // A seed item cannot be deleted, only tombstoned.
          removedItemIds: overlay.removedItemIds.includes(id)
            ? overlay.removedItemIds
            : [...overlay.removedItemIds, id],
        });
      },

      saveOutfit: (outfit) => {
        const { overlay } = get();
        commit({ ...overlay, savedOutfits: [outfit, ...overlay.savedOutfits] });
      },

      reset: () => {
        repository.clear();
        set(derive(emptyOverlay()));
      },
    };
  });
}

export const useWardrobe = createWardrobeStore(createLocalRepository());

export function useItem(id: ItemId | undefined): Item | undefined {
  return useWardrobe((state) => state.items.find((item) => item.id === id));
}

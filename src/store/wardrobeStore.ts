import { useMemo } from 'react';
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
import type { Item, ItemId, ItemPatch } from '~/domain/items';
import type { Outfit, OutfitId } from '~/domain/outfits';

interface WardrobeState {
  overlay: Overlay;
  items: Item[];
  outfits: Outfit[];
  addItem: (item: Item) => void;
  editItem: (id: ItemId, patch: ItemPatch) => void;
  removeItem: (id: ItemId) => void;
  saveOutfit: (outfit: Outfit) => void;
  renameOutfit: (id: OutfitId, name: string) => void;
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

      /*
       * Patches accumulate per item rather than replacing: correcting the brand
       * and then the silhouette leaves both corrected. The merge is shallow,
       * which is all the patch shape needs — every field in it is a scalar
       * except the palette, which is replaced whole.
       */
      editItem: (id, patch) => {
        const { overlay } = get();
        commit({
          ...overlay,
          itemEdits: { ...overlay.itemEdits, [id]: { ...overlay.itemEdits[id], ...patch } },
        });
      },

      removeItem: (id) => {
        const { overlay } = get();
        const { [id]: _dropped, ...itemEdits } = overlay.itemEdits;
        commit({
          ...overlay,
          addedItems: overlay.addedItems.filter((item) => item.id !== id),
          // Corrections to something no longer in the wardrobe are dead weight
          // in a store with a quota.
          itemEdits,
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

      renameOutfit: (id, name) => {
        const { overlay } = get();
        commit({ ...overlay, outfitNames: { ...overlay.outfitNames, [id]: name } });
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

/** Both screens that render a saved fit need to look its members up by id. */
export function useItemsById(): Map<ItemId, Item> {
  const items = useWardrobe((state) => state.items);
  return useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
}

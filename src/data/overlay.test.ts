import { describe, expect, it } from 'vitest';
import { testItem } from '~/domain/testItems';
import type { Outfit } from '~/domain/outfits';
import { emptyOverlay, mergeItems, mergeOutfits, outfitsWithAllItems } from './overlay';
import { SEED_ITEMS } from './seed/items';
import { SEED_OUTFITS } from './seed/outfits';

describe('merging the browser overlay onto the seed wardrobe', () => {
  it('shows the full seed wardrobe when nothing is stored', () => {
    expect(mergeItems(emptyOverlay())).toHaveLength(SEED_ITEMS.length);
  });

  it('puts newly added items first', () => {
    const added = testItem('new');
    expect(mergeItems({ ...emptyOverlay(), addedItems: [added] })[0]?.id).toBe('new');
  });

  it('hides a seed item behind a tombstone, since a fixture cannot be deleted', () => {
    const merged = mergeItems({ ...emptyOverlay(), removedItemIds: ['t1'] });
    expect(merged.some((item) => item.id === 't1')).toBe(false);
    expect(merged).toHaveLength(SEED_ITEMS.length - 1);
  });

  it('prepends saved fits so the newest sits first', () => {
    const saved: Outfit = {
      id: 'mine',
      name: 'Untitled fit',
      date: '2026-09-01',
      top: 't1',
      outer: null,
      bottom: 'b1',
      shoes: 's1',
    };
    const merged = mergeOutfits({ ...emptyOverlay(), savedOutfits: [saved] });
    expect(merged[0]?.id).toBe('mine');
    expect(merged).toHaveLength(SEED_OUTFITS.length + 1);
  });

  it('hands back a fresh overlay each time, so callers cannot alias one object', () => {
    const first = emptyOverlay();
    first.addedItems.push(testItem('x'));
    expect(emptyOverlay().addedItems).toHaveLength(0);
  });
});

describe('outfitsWithAllItems', () => {
  it('drops a fit whose garment has been removed, rather than rendering a hole', () => {
    const items = SEED_ITEMS.filter((item) => item.id !== 't2');
    const kept = outfitsWithAllItems(SEED_OUTFITS, items);
    expect(kept.some((fit) => fit.top === 't2')).toBe(false);
  });

  it('keeps a fit that skipped its outer layer', () => {
    const withoutOuter: Outfit = {
      id: 'f',
      name: 'Studio day',
      date: '2026-03-02',
      top: 't1',
      outer: null,
      bottom: 'b1',
      shoes: 's1',
    };
    const items = [
      testItem('t1', { category: 'top' }),
      testItem('b1', { category: 'bottom' }),
      testItem('s1', { category: 'shoes' }),
    ];
    expect(outfitsWithAllItems([withoutOuter], items)).toHaveLength(1);
  });
});

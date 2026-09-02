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

  it('applies a hand correction to a seed item, which the bundle cannot hold', () => {
    const merged = mergeItems({
      ...emptyOverlay(),
      itemEdits: { t1: { name: 'Renamed by hand' } },
    });
    expect(merged.find((item) => item.id === 't1')?.name).toBe('Renamed by hand');
  });

  it('leaves every field the correction did not name alone', () => {
    const seeded = SEED_ITEMS.find((item) => item.id === 't1');
    const merged = mergeItems({ ...emptyOverlay(), itemEdits: { t1: { brand: 'Elsewhere' } } });
    const patched = merged.find((item) => item.id === 't1');
    expect(patched?.brand).toBe('Elsewhere');
    expect(patched?.name).toBe(seeded?.name);
    expect(patched?.texture).toBe(seeded?.texture);
  });

  it('corrects an added item through the same path as a seeded one', () => {
    const merged = mergeItems({
      ...emptyOverlay(),
      addedItems: [testItem('new', { name: 'Typo' })],
      itemEdits: { new: { name: 'Fixed' } },
    });
    expect(merged[0]?.name).toBe('Fixed');
  });

  it('carries the dominant tone with the palette, so the two cannot disagree', () => {
    const merged = mergeItems({
      ...emptyOverlay(),
      addedItems: [testItem('new')],
      itemEdits: { new: { palette: ['#111111', '#222222', '#333333'] } },
    });
    expect(merged[0]?.tone).toBe('#111111');
  });

  it('ignores a correction left behind for an item that is gone', () => {
    const merged = mergeItems({
      ...emptyOverlay(),
      removedItemIds: ['t1'],
      itemEdits: { t1: { name: 'Renamed' } },
    });
    expect(merged.some((item) => item.id === 't1')).toBe(false);
  });

  it('renames a seeded fit without touching the rest of it', () => {
    const seeded = SEED_OUTFITS[0];
    if (!seeded) throw new Error('the seed ships at least one fit');
    const merged = mergeOutfits({ ...emptyOverlay(), outfitNames: { [seeded.id]: 'Studio day' } });
    expect(merged.find((fit) => fit.id === seeded.id)).toEqual({ ...seeded, name: 'Studio day' });
  });

  it('accepts an empty string as a rename, rather than reading it as no rename', () => {
    const seeded = SEED_OUTFITS[0];
    if (!seeded) throw new Error('the seed ships at least one fit');
    const merged = mergeOutfits({ ...emptyOverlay(), outfitNames: { [seeded.id]: '' } });
    expect(merged.find((fit) => fit.id === seeded.id)?.name).toBe('');
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

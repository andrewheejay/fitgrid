import { describe, expect, it } from 'vitest';
import { layersOf, NO_OUTER, outfitFromSelection, poolsFrom, type Outfit } from './outfits';
import { testItem } from './testItems';

const ITEMS = [
  testItem('t1', { category: 'top' }),
  testItem('o1', { category: 'outer' }),
  testItem('o2', { category: 'outer' }),
  testItem('b1', { category: 'bottom' }),
  testItem('s1', { category: 'shoes' }),
];

const META = { id: 'f1', name: 'Untitled fit', date: '2026-09-01' };

describe('poolsFrom', () => {
  it('puts the skip option first in the outer rail, and nowhere else', () => {
    const pools = poolsFrom(ITEMS);
    expect(pools.outer).toEqual([NO_OUTER, 'o1', 'o2']);
    expect(pools.top).toEqual(['t1']);
    expect(pools.bottom).not.toContain(NO_OUTER);
  });

  it('makes a four-jacket wardrobe a pool of exactly five', () => {
    const outer = ['o1', 'o2', 'o3', 'o4'].map((id) => testItem(id, { category: 'outer' }));
    expect(poolsFrom(outer).outer).toHaveLength(5);
  });
});

describe('outfitFromSelection', () => {
  it('builds a fit from a full selection', () => {
    const fit = outfitFromSelection(
      { top: 't1', outer: 'o1', bottom: 'b1', shoes: 's1' },
      META,
    );
    expect(fit).toMatchObject({ top: 't1', outer: 'o1', bottom: 'b1', shoes: 's1' });
  });

  it('stores a skipped outer layer as null, not as a sentinel id', () => {
    const fit = outfitFromSelection(
      { top: 't1', outer: NO_OUTER, bottom: 'b1', shoes: 's1' },
      META,
    );
    expect(fit?.outer).toBeNull();
  });

  it('refuses to build a fit missing a required layer', () => {
    expect(
      outfitFromSelection({ top: 't1', outer: 'o1', bottom: undefined, shoes: 's1' }, META),
    ).toBeNull();
  });
});

describe('layersOf', () => {
  it('walks a fit in layer order, with null for a skipped outer', () => {
    const fit: Outfit = { ...META, top: 't1', outer: null, bottom: 'b1', shoes: 's1' };
    expect(layersOf(fit)).toEqual([
      { layer: 'top', itemId: 't1' },
      { layer: 'outer', itemId: null },
      { layer: 'bottom', itemId: 'b1' },
      { layer: 'shoes', itemId: 's1' },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { testItem } from './testItems';
import { applySort, filterChips, visibleItems, wardrobeSubtitle } from './wardrobe';

const ITEMS = [
  testItem('t1', { category: 'top', addedAt: '2026-03-04', wornCount: 12, aesthetic: 'workwear' }),
  testItem('t2', { category: 'top', addedAt: '2026-01-02', wornCount: 33, aesthetic: 'casual' }),
  testItem('o1', { category: 'outer', addedAt: '2026-02-27', wornCount: 6, aesthetic: 'quiet' }),
  testItem('b1', { category: 'bottom', addedAt: '2026-02-18', wornCount: 1, aesthetic: 'sport' }),
  testItem('s1', { category: 'shoes', addedAt: '2026-02-05', wornCount: 9, aesthetic: 'utility' }),
];

describe('filter chips', () => {
  it('derives every count from the items, never from a stored number', () => {
    expect(filterChips(ITEMS).map((chip) => [chip.label, chip.count])).toEqual([
      ['All', 5],
      ['Tops', 2],
      ['Outerwear', 1],
      ['Bottoms', 1],
      ['Shoes', 1],
    ]);
  });

  it('follows the wardrobe as it changes', () => {
    const chips = filterChips([...ITEMS, testItem('t3', { category: 'top' })]);
    expect(chips[0]?.count).toBe(6);
    expect(chips[1]?.count).toBe(3);
  });

  it('pluralises Outerwear and Shoes correctly', () => {
    const labels = filterChips(ITEMS).map((chip) => chip.label);
    expect(labels).not.toContain('Outerwears');
    expect(labels).not.toContain('Shoess');
  });
});

describe('sorting', () => {
  it('puts the most recently added first', () => {
    expect(applySort(ITEMS, 'recent').map((item) => item.id)).toEqual([
      't1',
      'o1',
      'b1',
      's1',
      't2',
    ]);
  });

  it('sorts dates chronologically across a year boundary', () => {
    const across = [
      testItem('older', { addedAt: '2025-12-31' }),
      testItem('newer', { addedAt: '2026-01-01' }),
    ];
    expect(applySort(across, 'recent')[0]?.id).toBe('newer');
  });

  it('puts the most worn first', () => {
    expect(applySort(ITEMS, 'worn')[0]?.id).toBe('t2');
  });

  it('groups by aesthetic', () => {
    expect(applySort(ITEMS, 'aesthetic').map((item) => item.aesthetic)).toEqual([
      'casual',
      'quiet',
      'sport',
      'utility',
      'workwear',
    ]);
  });

  it('does not mutate the list it is given', () => {
    const order = ITEMS.map((item) => item.id);
    applySort(ITEMS, 'worn');
    expect(ITEMS.map((item) => item.id)).toEqual(order);
  });
});

describe('visibleItems', () => {
  it('filters then sorts', () => {
    expect(visibleItems(ITEMS, 'top', 'worn').map((item) => item.id)).toEqual(['t2', 't1']);
  });
});

describe('wardrobeSubtitle', () => {
  it('counts items, singular and plural', () => {
    expect(wardrobeSubtitle(18)).toBe('18 items · tagged automatically');
    expect(wardrobeSubtitle(1)).toBe('1 item · tagged automatically');
  });
});

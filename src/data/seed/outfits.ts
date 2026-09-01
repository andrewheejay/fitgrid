import type { Outfit } from '~/domain/outfits';

/** "Studio day" has no outer layer — null, not a sentinel item. */
export const SEED_OUTFITS: readonly Outfit[] = [
  { id: 'f1', name: 'Cold commute', date: '2026-03-04', top: 't2', outer: 'o3', bottom: 'b1', shoes: 's4' },
  { id: 'f2', name: 'Studio day', date: '2026-03-02', top: 't7', outer: null, bottom: 'b2', shoes: 's2' },
  { id: 'f3', name: 'Dinner, dry', date: '2026-02-28', top: 't4', outer: 'o1', bottom: 'b1', shoes: 's1' },
  { id: 'f4', name: 'Errands', date: '2026-02-25', top: 't5', outer: 'o2', bottom: 'b3', shoes: 's3' },
];

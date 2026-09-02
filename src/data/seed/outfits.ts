import type { Outfit } from '~/domain/outfits';

/** Saved fits built from the wardrobe above. A null outer layer was skipped. */
export const SEED_OUTFITS: readonly Outfit[] = [
  { id: 'f1', name: 'Japan', date: '2026-09-02', top: 't1', outer: 'o1', bottom: 'b2', shoes: 's3' },
];

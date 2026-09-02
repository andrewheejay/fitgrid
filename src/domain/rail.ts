/**
 * Stepping a deck rail's selection.
 *
 * This file used to also own `railWindow`, which chose five of a pool's items
 * to render — and the bug it guarded against was that a five-wide window over a
 * four-item pool wraps and shows the same jacket twice. The rail now renders
 * the pool whole and scrolls, so there is no window to get wrong: the class of
 * bug is gone rather than tested for.
 */

/** Step through a pool with wrapping, in either direction. */
export function cycleIndex(poolSize: number, current: number, direction: -1 | 1): number {
  if (poolSize <= 0) return 0;
  return (current + direction + poolSize) % poolSize;
}
